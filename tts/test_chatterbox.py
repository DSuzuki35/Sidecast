import unittest
from chatterbox_worker import expression_settings
from worker import RequestError


class ExpressionTests(unittest.TestCase):
    def test_model_side_expression_and_pacing(self):
        self.assertEqual(expression_settings(0), (0, 0.5))
        self.assertEqual(expression_settings(50), (0.5, 0.5))
        self.assertEqual(expression_settings(75), (0.75, 0.3))
        self.assertEqual(expression_settings(100), (1, 0.3))

    def test_invalid_expression_is_rejected_before_loading_a_model(self):
        for value in (-1, 101, float('nan'), float('inf'), '75', None, True):
            with self.assertRaises(RequestError):
                expression_settings(value)


if __name__ == '__main__':
    unittest.main()
