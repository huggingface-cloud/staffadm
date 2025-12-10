"""
Authentication Service Module
Handles JWT token generation/validation, password hashing, and user authentication.
"""

import os
from datetime import datetime, timedelta
from typing import Optional, Dict
import jwt
import bcrypt
from database import get_supabase


# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24


class AuthenticationError(Exception):
    """Custom exception for authentication errors"""
    pass


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt with 12 rounds.

    Args:
        password: Plain text password

    Returns:
        Hashed password string
    """
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password.

    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password from database

    Returns:
        True if password matches, False otherwise
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False


def create_access_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: Dictionary containing user data to encode in token
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow()
    })

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Dict:
    """
    Decode and validate a JWT token.

    Args:
        token: JWT token string

    Returns:
        Dictionary containing decoded token data

    Raises:
        AuthenticationError: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token has expired")
    except jwt.InvalidTokenError:
        raise AuthenticationError("Invalid token")


def authenticate_user(email: str, password: str) -> Optional[Dict]:
    """
    Authenticate a user by email and password.

    Args:
        email: User email address
        password: Plain text password

    Returns:
        Dictionary containing user data if authentication successful, None otherwise

    Raises:
        AuthenticationError: If authentication fails
    """
    try:
        supabase = get_supabase()

        # Fetch user by email
        response = supabase.table("admin_users").select("""
            id,
            email,
            password_hash,
            full_name,
            department_id,
            role,
            is_active
        """).eq("email", email).eq("is_active", True).execute()

        if not response.data or len(response.data) == 0:
            raise AuthenticationError("Invalid email or password")

        user = response.data[0]

        # Verify password
        if not verify_password(password, user["password_hash"]):
            raise AuthenticationError("Invalid email or password")

        # Update last_login timestamp
        supabase.table("admin_users").update({
            "last_login": datetime.utcnow().isoformat()
        }).eq("id", user["id"]).execute()

        # Remove password hash from returned data
        user.pop("password_hash", None)

        # Fetch department name if department_id exists
        if user.get("department_id"):
            dept_response = supabase.table("departments").select("name, code").eq(
                "id", user["department_id"]
            ).execute()

            if dept_response.data and len(dept_response.data) > 0:
                user["department_name"] = dept_response.data[0]["name"]
                user["department_code"] = dept_response.data[0].get("code")

        return user

    except AuthenticationError:
        raise
    except Exception as e:
        raise AuthenticationError(f"Authentication failed: {str(e)}")


def get_user_by_id(user_id: str) -> Optional[Dict]:
    """
    Get user details by user ID.

    Args:
        user_id: User UUID

    Returns:
        Dictionary containing user data or None if not found
    """
    try:
        supabase = get_supabase()

        response = supabase.table("admin_users").select("""
            id,
            email,
            full_name,
            department_id,
            role,
            is_active,
            created_at,
            last_login
        """).eq("id", user_id).eq("is_active", True).execute()

        if not response.data or len(response.data) == 0:
            return None

        user = response.data[0]

        # Fetch department name if department_id exists
        if user.get("department_id"):
            dept_response = supabase.table("departments").select("name, code").eq(
                "id", user["department_id"]
            ).execute()

            if dept_response.data and len(dept_response.data) > 0:
                user["department_name"] = dept_response.data[0]["name"]
                user["department_code"] = dept_response.data[0].get("code")

        return user

    except Exception:
        return None


def create_admin_user(
    email: str,
    password: str,
    full_name: str,
    department_id: Optional[str] = None,
    role: str = "dept_admin"
) -> Dict:
    """
    Create a new admin user.

    Args:
        email: User email address
        password: Plain text password (will be hashed)
        full_name: User's full name
        department_id: Department UUID (None for super_admin)
        role: User role ('super_admin' or 'dept_admin')

    Returns:
        Dictionary containing created user data

    Raises:
        AuthenticationError: If user creation fails
    """
    try:
        supabase = get_supabase()

        # Check if email already exists
        existing = supabase.table("admin_users").select("id").eq("email", email).execute()
        if existing.data and len(existing.data) > 0:
            raise AuthenticationError("Email already exists")

        # Hash password
        password_hash = hash_password(password)

        # Create user
        user_data = {
            "email": email,
            "password_hash": password_hash,
            "full_name": full_name,
            "department_id": department_id,
            "role": role,
            "is_active": True
        }

        response = supabase.table("admin_users").insert(user_data).execute()

        if not response.data or len(response.data) == 0:
            raise AuthenticationError("Failed to create user")

        created_user = response.data[0]
        created_user.pop("password_hash", None)

        return created_user

    except AuthenticationError:
        raise
    except Exception as e:
        raise AuthenticationError(f"User creation failed: {str(e)}")


def change_password(user_id: str, old_password: str, new_password: str) -> bool:
    """
    Change user password.

    Args:
        user_id: User UUID
        old_password: Current password
        new_password: New password

    Returns:
        True if password changed successfully

    Raises:
        AuthenticationError: If password change fails
    """
    try:
        supabase = get_supabase()

        # Fetch user
        response = supabase.table("admin_users").select(
            "id, password_hash"
        ).eq("id", user_id).execute()

        if not response.data or len(response.data) == 0:
            raise AuthenticationError("User not found")

        user = response.data[0]

        # Verify old password
        if not verify_password(old_password, user["password_hash"]):
            raise AuthenticationError("Current password is incorrect")

        # Hash new password
        new_password_hash = hash_password(new_password)

        # Update password
        supabase.table("admin_users").update({
            "password_hash": new_password_hash
        }).eq("id", user_id).execute()

        return True

    except AuthenticationError:
        raise
    except Exception as e:
        raise AuthenticationError(f"Password change failed: {str(e)}")


def check_department_access(user: Dict, department_id: str) -> bool:
    """
    Check if user has access to a specific department.

    Args:
        user: User dictionary containing role and department_id
        department_id: Department UUID to check access for

    Returns:
        True if user has access, False otherwise
    """
    # Super admins have access to all departments
    if user.get("role") == "super_admin":
        return True

    # Department admins only have access to their own department
    return user.get("department_id") == department_id


def get_user_departments(user: Dict) -> list:
    """
    Get list of department IDs the user has access to.

    Args:
        user: User dictionary containing role and department_id

    Returns:
        List of department IDs user can access
    """
    # Super admins have access to all departments
    if user.get("role") == "super_admin":
        try:
            supabase = get_supabase()
            response = supabase.table("departments").select("id").execute()
            return [dept["id"] for dept in response.data]
        except Exception:
            return []

    # Department admins only have access to their own department
    if user.get("department_id"):
        return [user["department_id"]]

    return []
