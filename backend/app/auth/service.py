def get_user(conn, user_id):
    return conn.execute(
        "SELECT id, email, password_hash FROM users WHERE id = %s", (user_id,)
    ).fetchone()


def get_user_by_email(conn, email):
    return conn.execute(
        "SELECT id, email, password_hash FROM users WHERE email = %s", (email,)
    ).fetchone()


def create_user(conn, email, password_hash):
    return conn.execute(
        "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id, email",
        (email, password_hash),
    ).fetchone()
