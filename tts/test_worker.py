"""Protocol tests: reject unsafe requests before any model import/download."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import wave
from worker import split_text


class SpeechTextTests(unittest.TestCase):
    def test_chunks_preserve_all_text_and_unicode(self):
        for text in ('Hello there. ' * 70 + 'Final words 🏁', '長い文章' * 300, '👩🏽‍🚀' * 100):
            chunks = split_text(text)
            self.assertGreater(len(chunks), 1)
            self.assertEqual(''.join(chunks), text)
            self.assertTrue(all(0 < len(chunk) <= 240 for chunk in chunks))

    def test_prefers_sentence_and_word_boundaries(self):
        text = 'A short sentence. ' * 20
        self.assertTrue(all(chunk.endswith(' ') for chunk in split_text(text)))


class WorkerProtocolTests(unittest.TestCase):
    def test_rejects_invalid_requests_and_recovers_in_same_process(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            reference = root / "voice.wav"
            reference.write_bytes(b"not needed for validation")
            valid = dict(id="a", text="Hallo", language="German", reference=str(reference),
                         referenceText="", output=str(root / "cache" / "out.wav"), device="cpu")
            requests = [
                {**valid, "text": "x" * 6001},
                {**valid, "reference": str(root.parent / "outside.wav")},
                {**valid, "output": str(root.parent / "outside.wav")},
                {**valid, "output": "relative.wav"},
                {**valid, "output": str(reference)},
                {**valid, "language": "unknown"},
                {**valid, "device": "other"},
                {**valid, "referenceText": 3},
            ]
            payload = "\n".join(["{broken", "[]", *[json.dumps(r) for r in requests]]) + "\n"
            result = subprocess.run([sys.executable, str(Path(__file__).with_name("worker.py")),
                                     "--root", str(root)], input=payload, text=True,
                                    capture_output=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            lines = result.stdout.splitlines()
            self.assertEqual(len(lines), 10, result.stderr)
            for line in lines:
                reply = json.loads(line)
                self.assertIs(reply["ok"], False)
                self.assertTrue(reply["error"])
            for line, expected in zip(lines, ("JSON", "object", "6000", "inside", "inside",
                                              "absolute", "overwrite", "English", "CPU", "transcript")):
                self.assertIn(expected, json.loads(line)["error"])
            self.assertEqual(json.loads(lines[-1])["id"], "a")
            self.assertFalse((root / "cache" / "out.wav").exists())

    def test_silent_reference_is_rejected_without_model_loading(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            reference = root / "silent.wav"
            with wave.open(str(reference), "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(24000)
                wav.writeframes(bytes(24000 * 2 * 4))
            request = dict(id=8, text="Hello", language="English", reference=str(reference),
                           output=str(root / "out.wav"), device="cpu")
            result = subprocess.run([sys.executable, str(Path(__file__).with_name("worker.py")),
                                     "--root", str(root)], input=json.dumps(request) + "\n",
                                    text=True, capture_output=True, timeout=15)
            self.assertEqual(result.returncode, 0, result.stderr)
            response = json.loads(result.stdout)
            self.assertIs(response["ok"], False)
            self.assertIn("silent", response["error"])
            self.assertFalse((root / "out.wav").exists())


if __name__ == "__main__":
    unittest.main()
