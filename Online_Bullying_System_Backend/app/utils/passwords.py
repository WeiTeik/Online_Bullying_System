import random
import re
import secrets
import string
from typing import Optional

DEFAULT_SPECIAL_CHARACTERS = "!@#$%^&*()-_=+[]{}<>?/|~"
PASSWORD_SPECIAL_CHARACTERS = "!@#$%^&*()_+-={}[]:;\"'<>.,?/"
COMMON_PASSWORD_PATTERNS = {
    "password",
    "passw0rd",
    "letmein",
    "welcome",
    "admin",
    "root",
    "123456",
    "1234567",
    "12345678",
    "123456789",
    "1234567890",
    "qwerty",
    "abc123",
    "iloveyou",
}
KEYBOARD_SEQUENCES = (
    "qwertyuiop",
    "asdfghjkl",
    "zxcvbnm",
)


def _contains_ascending_sequence(value: str, length: int = 4) -> bool:
    normalized = value.lower()
    for seq in KEYBOARD_SEQUENCES + ("abcdefghijklmnopqrstuvwxyz", "0123456789"):
        for index in range(len(seq) - length + 1):
            if seq[index : index + length] in normalized:
                return True

    for index in range(len(normalized) - length + 1):
        window = normalized[index : index + length]
        if all(ord(window[i + 1]) - ord(window[i]) == 1 for i in range(length - 1)):
            return True
        if all(ord(window[i]) - ord(window[i + 1]) == 1 for i in range(length - 1)):
            return True
    return False


def _contains_repeated_characters(value: str, length: int = 4) -> bool:
    for index in range(len(value) - length + 1):
        window = value[index : index + length]
        if window == window[0] * length:
            return True
    return False


def _contains_personal_information(password: str, user) -> bool:
    if not user:
        return False

    def normalize(value: str) -> str:
        return re.sub(r"[^a-z0-9]", "", value.lower())

    password_normalized = normalize(password)
    raw_values = [
        getattr(user, "full_name", "") or "",
        getattr(user, "email", "") or "",
        getattr(user, "username", "") or "",
    ]
    personal_values = set()
    for raw in raw_values:
        normalized_full = normalize(raw)
        if normalized_full:
            personal_values.add(normalized_full)
        for fragment in re.split(r"[\s@._-]+", str(raw)):
            normalized_fragment = normalize(fragment)
            if len(normalized_fragment) >= 3:
                personal_values.add(normalized_fragment)
    for value in personal_values:
        if value and value in password_normalized:
            return True
    return False


def validate_password_strength(password: str, *, user=None) -> Optional[str]:
    if not password:
        return "Password is required."
    if len(password) < 8:
        return "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return "Password must include at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return "Password must include at least one lowercase letter."
    if not re.search(r"[0-9]", password):
        return "Password must include at least one number."
    special_characters_pattern = re.compile(f"[{re.escape(PASSWORD_SPECIAL_CHARACTERS)}]")
    if not special_characters_pattern.search(password):
        return (
            "Password must include at least one special character "
            "(! @ # $ % ^ & * ( ) _ + - = { } [ ] : ; \" ' < > , . ? /)."
        )

    lowered = password.lower()
    if lowered in COMMON_PASSWORD_PATTERNS:
        return "Password is too common. Choose something harder to guess."
    for pattern in COMMON_PASSWORD_PATTERNS:
        if pattern in lowered:
            return "Password should not contain common words like 'password' or '123456'."

    if _contains_personal_information(password, user):
        return "Password must not contain your personal information."

    if _contains_ascending_sequence(password, 4):
        return "Password must not contain sequential patterns like 'abcd' or '1234'."

    if _contains_repeated_characters(password, 4):
        return "Password must not contain repeated characters like '1111'."

    return None


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
