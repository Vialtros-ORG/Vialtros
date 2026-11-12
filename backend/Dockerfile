FROM python:3.14-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.lock ./requirements.lock

RUN pip install --no-cache-dir --require-hashes --only-binary=:all: -r requirements.lock \
    && groupadd --system app \
    && useradd --system --gid app --home-dir /app --shell /usr/sbin/nologin app \
    && mkdir -p /app/staticfiles \
    && chown -R app:app /app

COPY --chown=app:app manage.py entrypoint.sh ./
COPY --chown=app:app core ./core
COPY --chown=app:app tracking ./tracking
COPY --chown=app:app users ./users

RUN sed -i 's/\r$//' /app/entrypoint.sh \
    && chmod 0555 /app/entrypoint.sh

USER app

RUN DJANGO_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(64))')" python manage.py collectstatic --noinput

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "core.asgi:application"]
