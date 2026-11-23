"""Manual inference check with an explicitly supplied, consented voice reference."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import time

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--device", choices=("cuda", "cpu"), default="cuda")
    parser.add_argument("--transcript", default="")
    args = parser.parse_args()
    process = subprocess.Popen(
        [sys.executable, "-u", str(Path(__file__).with_name("worker.py")), "--root", str(args.root.resolve())],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, encoding="utf-8",
    )
    report = []
    try:
        for language, message in (("German", "Danke fuer deinen Follow. Willkommen im Stream!"),
                                  ("English", "Thanks for following. Welcome to the stream!")):
            start = time.monotonic()
            request = dict(id=language, text=message, language=language, reference=str(args.reference.resolve()),
                           referenceText=args.transcript, device=args.device,
                           output=str(args.root.resolve() / f"{language.lower()}-test.wav"))
            process.stdin.write(json.dumps(request) + "\n")
            process.stdin.flush()
            response = json.loads(process.stdout.readline())
            response["elapsedSeconds"] = round(time.monotonic() - start, 2)
            report.append(response)
            print(json.dumps(response), flush=True)
            if not response["ok"]:
                raise RuntimeError(response["error"])
        (args.root / "benchmark.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    finally:
        process.stdin.close()
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
