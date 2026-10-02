class LastAdminError(Exception):
    pass


def create_space_with_admin(conn, name, user_id):
    with conn.transaction():
        space = conn.execute("INSERT INTO spaces (name) VALUES (%s) RETURNING id, name", (name,)).fetchone()
        conn.execute(
            "INSERT INTO space_members (space_id, user_id, role) VALUES (%s, %s, 'admin')",
            (space["id"], user_id),
        )
    return {**space, "role": "admin"}


def get_role(conn, user_id, space_id):
    row = conn.execute(
        "SELECT role FROM space_members WHERE space_id = %s AND user_id = %s", (space_id, user_id)
    ).fetchone()
    return row["role"] if row else None


def list_my_spaces(conn, user_id):
    return conn.execute(
        """SELECT s.id, s.name, m.role
           FROM spaces s JOIN space_members m ON m.space_id = s.id
           WHERE m.user_id = %s ORDER BY s.id""",
        (user_id,),
    ).fetchall()


def list_members(conn, space_id):
    return conn.execute(
        """SELECT m.user_id, u.email, m.role
           FROM space_members m JOIN users u ON u.id = m.user_id
           WHERE m.space_id = %s ORDER BY m.user_id""",
        (space_id,),
    ).fetchall()


def _locked_admin_ids(conn, space_id):
    rows = conn.execute(
        "SELECT user_id FROM space_members WHERE space_id = %s AND role = 'admin' ORDER BY user_id FOR UPDATE",
        (space_id,),
    ).fetchall()
    return [r["user_id"] for r in rows]


def set_member_role(conn, space_id, user_id, role):
    with conn.transaction():
        admins = _locked_admin_ids(conn, space_id)
        if user_id in admins and role != "admin" and len(admins) == 1:
            raise LastAdminError()
        return conn.execute(
            """INSERT INTO space_members (space_id, user_id, role) VALUES (%s, %s, %s)
               ON CONFLICT (space_id, user_id) DO UPDATE SET role = EXCLUDED.role
               RETURNING user_id, role""",
            (space_id, user_id, role),
        ).fetchone()


def remove_member(conn, space_id, user_id) -> bool:
    with conn.transaction():
        admins = _locked_admin_ids(conn, space_id)
        if user_id in admins and len(admins) == 1:
            raise LastAdminError()
        return conn.execute(
            "DELETE FROM space_members WHERE space_id = %s AND user_id = %s", (space_id, user_id)
        ).rowcount > 0
