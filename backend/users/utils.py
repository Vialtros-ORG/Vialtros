import re
import unicodedata


def normalize_name(value):
    """
    Normaliza un nombre de persona a Title Case.
    - Elimina espacios al inicio/final y espacios duplicados.
    - Convierte la primera letra de cada palabra a mayúscula y el resto a minúscula.
    - Compatible con caracteres Unicode (tildes, ñ, etc.).

    Ejemplo: '  jUaN   caRlOs  péReZ  ' -> 'Juan Carlos Pérez'
    """
    if not value:
        return ""
    cleaned = re.sub(r'\s+', ' ', str(value).strip())
    return unicodedata.normalize('NFC', cleaned).title()


def normalize_phone(value):
    """Normalize a formatted international or Colombian phone number to E.164."""
    cleaned = re.sub(r'[\s().-]', '', str(value or ''))
    if cleaned.startswith('00'):
        cleaned = f'+{cleaned[2:]}'
    elif len(cleaned) == 10 and cleaned.isdigit():
        cleaned = f'+57{cleaned}'
    elif cleaned and not cleaned.startswith('+'):
        cleaned = f'+{cleaned}'
    return cleaned
