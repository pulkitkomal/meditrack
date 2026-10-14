from fastapi import HTTPException, Request

AUTH_COOKIE_NAME = "access_token"


async def oauth2_scheme(request: Request) -> str:
    """Read the JWT from the httpOnly auth cookie, falling back to an Authorization: Bearer header."""
    token = request.cookies.get(AUTH_COOKIE_NAME)
    if token:
        return token
    scheme, _, credentials = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() == "bearer" and credentials:
        return credentials
    raise HTTPException(status_code=401, detail="Not authenticated", headers={"WWW-Authenticate": "Bearer"})
