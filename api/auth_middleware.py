"""
Authentication Middleware for FastAPI
Provides decorators and dependencies for protecting routes and extracting user info.
"""

from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from auth import decode_access_token, AuthenticationError, get_user_by_id


security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency to get the current authenticated user from JWT token.

    Usage:
        @app.get("/api/protected")
        async def protected_route(current_user: dict = Depends(get_current_user)):
            return {"user": current_user}

    Args:
        credentials: HTTP Bearer credentials (JWT token)

    Returns:
        Dictionary containing user data

    Raises:
        HTTPException: If token is invalid or user not found
    """
    try:
        # Decode token
        token_data = decode_access_token(credentials.credentials)

        # Extract user_id from token
        user_id = token_data.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: user_id missing"
            )

        # Fetch user from database
        user = get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )

        return user

    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )


async def get_current_super_admin(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Dependency to ensure current user is a super admin.

    Usage:
        @app.get("/api/admin/sensitive")
        async def admin_only_route(admin: dict = Depends(get_current_super_admin)):
            return {"admin": admin}

    Args:
        current_user: Current authenticated user

    Returns:
        Dictionary containing user data

    Raises:
        HTTPException: If user is not a super admin
    """
    if current_user.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required"
        )

    return current_user


async def get_current_dept_admin(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Dependency to ensure current user is a department admin (or super admin).

    Usage:
        @app.get("/api/dept/data")
        async def dept_route(admin: dict = Depends(get_current_dept_admin)):
            return {"admin": admin}

    Args:
        current_user: Current authenticated user

    Returns:
        Dictionary containing user data

    Raises:
        HTTPException: If user is not an admin
    """
    if current_user.get("role") not in ["super_admin", "dept_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return current_user


def require_department_access(department_id: str, user: dict) -> None:
    """
    Check if user has access to a specific department.

    Usage:
        @app.get("/api/departments/{dept_id}/data")
        async def get_dept_data(
            dept_id: str,
            current_user: dict = Depends(get_current_user)
        ):
            require_department_access(dept_id, current_user)
            # ... continue with logic

    Args:
        department_id: Department UUID to check
        user: Current user dictionary

    Raises:
        HTTPException: If user doesn't have access to department
    """
    from auth import check_department_access

    if not check_department_access(user, department_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this department"
        )


async def get_optional_user(
    authorization: Optional[str] = Header(None)
) -> Optional[dict]:
    """
    Dependency to get current user if token is provided, None otherwise.
    Useful for routes that work both with and without authentication.

    Usage:
        @app.get("/api/public-or-private")
        async def flexible_route(user: Optional[dict] = Depends(get_optional_user)):
            if user:
                return {"message": f"Hello {user['full_name']}"}
            return {"message": "Hello guest"}

    Args:
        authorization: Optional Authorization header

    Returns:
        User dictionary if authenticated, None otherwise
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None

    try:
        token = authorization.replace("Bearer ", "")
        token_data = decode_access_token(token)

        user_id = token_data.get("user_id")
        if not user_id:
            return None

        user = get_user_by_id(user_id)
        return user

    except Exception:
        return None


# Utility function for filtering queries by department
def apply_department_filter(query, user: dict, department_field: str = "department_id"):
    """
    Apply department filtering to a Supabase query based on user role.

    Usage:
        query = supabase.table("employees").select("*")
        query = apply_department_filter(query, current_user)
        results = query.execute()

    Args:
        query: Supabase query object
        user: Current user dictionary
        department_field: Name of the department field to filter on

    Returns:
        Filtered query object
    """
    # Super admins see all departments
    if user.get("role") == "super_admin":
        return query

    # Department admins only see their department
    if user.get("department_id"):
        return query.eq(department_field, user["department_id"])

    # User has no department (should not happen, but handle gracefully)
    # Return empty result by filtering on impossible condition
    return query.eq(department_field, "00000000-0000-0000-0000-000000000000")
