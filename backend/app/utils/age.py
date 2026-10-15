from datetime import date


def age_from_dob(dob, today: date | None = None) -> int | None:
    if isinstance(dob, str):
        try:
            dob = date.fromisoformat(dob[:10])
        except ValueError:
            return None
    if not isinstance(dob, date):
        return None
    today = today or date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def user_age(user: dict) -> int | None:
    return age_from_dob(user.get("date_of_birth")) or user.get("age")
