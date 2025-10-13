from email.message import EmailMessage
import smtplib
from typing import Iterable, Optional, Union

from flask import current_app


def _resolve_sender(default_sender: Optional[str], username: Optional[str]) -> str:
    sender = (default_sender or username or "").strip()
    if not sender:
        raise RuntimeError("Email sender is not configured. Set MAIL_DEFAULT_SENDER or MAIL_USERNAME.")
    return sender


def send_email(
    subject: str,
    recipients: Union[str, Iterable[str]],
    text_body: str,
    html_body: Optional[str] = None,
) -> None:
    """
    Send an email using SMTP settings defined in the Flask config.
    Expects the following configuration keys:
      MAIL_SERVER, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD,
      MAIL_USE_TLS, MAIL_USE_SSL, MAIL_DEFAULT_SENDER, MAIL_TIMEOUT
    """
    app = current_app._get_current_object()  # type: ignore[attr-defined]
    if not app.config.get("MAIL_ENABLED", True):
        app.logger.info("MAIL_ENABLED is False; skipping email delivery to %s", recipients)
        return

    host = app.config.get("MAIL_SERVER")
    if not host:
        app.logger.warning("MAIL_SERVER is not configured; skipping email delivery to %s", recipients)
        return

    port = int(app.config.get("MAIL_PORT", 465))
    username = app.config.get("MAIL_USERNAME")
    password = app.config.get("MAIL_PASSWORD")
    use_tls = bool(app.config.get("MAIL_USE_TLS", False))
    use_ssl = bool(app.config.get("MAIL_USE_SSL", True))
    timeout = int(app.config.get("MAIL_TIMEOUT", 30))
    sender = _resolve_sender(app.config.get("MAIL_DEFAULT_SENDER"), username)

    if isinstance(recipients, str):
        recipients_list = [recipients]
    else:
        recipients_list = list(recipients)
    if not recipients_list:
        raise RuntimeError("At least one recipient email address is required.")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = ", ".join(recipients_list)
    message.set_content(text_body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    smtp_class = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
    with smtp_class(host, port, timeout=timeout) as smtp:
        if use_tls and not use_ssl:
            smtp.starttls()
        if username and password:
            smtp.login(username, password)
        smtp.send_message(message)
