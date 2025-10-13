import random
import secrets
import string

DEFAULT_SPECIAL_CHARACTERS = "!@#$%^&*()-_=+[]{}<>?/|~"


def generate_strong_password(length: int = 12, special_chars: str = DEFAULT_SPECIAL_CHARACTERS) -> str:
    """
    Generate a cryptographically secure password that satisfies the following:
      * Contains at least one uppercase letter
      * Contains at least one lowercase letter
      * Contains at least one digit
      * Contains at least one special character
    """
    length = max(length, 8)
    if not special_chars:
        special_chars = DEFAULT_SPECIAL_CHARACTERS

    categories = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice(special_chars),
    ]

    remaining_length = length - len(categories)
    if remaining_length > 0:
        all_characters = string.ascii_letters + string.digits + special_chars
        categories.extend(secrets.choice(all_characters) for _ in range(remaining_length))

    sys_random = random.SystemRandom()
    sys_random.shuffle(categories)
    return "".join(categories)
