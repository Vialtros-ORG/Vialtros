import getpass
import os
import re
import sys

from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email


User = get_user_model()


class Command(BaseCommand):
    help = 'Create an administrator account without a hard-coded password.'

    def add_arguments(self, parser):
        parser.add_argument('--username', default='admin')
        parser.add_argument('--email', default='')

    def handle(self, *args, **options):
        username = options['username'].strip().lower()
        email = options['email'].strip().lower()

        if not re.fullmatch(r'[a-z0-9][a-z0-9._-]{2,29}', username):
            raise CommandError(
                'El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo.'
            )
        existing_admin = User.objects.filter(role='admin').first()
        if existing_admin:
            if existing_admin.is_superuser:
                self.stdout.write(
                    self.style.WARNING(
                        f'Ya existe la cuenta administradora "{existing_admin.username}"; no se modificó.'
                    )
                )
                return
            raise CommandError('La cuenta con rol administrador no tiene privilegios de superusuario; revisa la configuración.')

        existing_user = User.objects.filter(username__iexact=username).first()
        if existing_user:
            raise CommandError(
                f'El usuario "{username}" ya existe con otro rol. Elige otro nombre; no se cambiará su rol automáticamente.'
            )
        if email:
            try:
                validate_email(email)
            except ValidationError as exc:
                raise CommandError('El correo no tiene un formato válido.') from exc
            if User.objects.filter(email__iexact=email).exists():
                raise CommandError('Ese correo ya está registrado en otra cuenta.')

        password = os.environ.get('VIALTROS_ADMIN_PASSWORD', '')
        if not password:
            if not sys.stdin.isatty():
                raise CommandError(
                    'Define VIALTROS_ADMIN_PASSWORD para uso no interactivo o ejecuta el comando en una terminal.'
                )
            password = getpass.getpass('Contraseña nueva del administrador: ')
            confirmation = getpass.getpass('Confirma la contraseña: ')
            if password != confirmation:
                raise CommandError('Las contraseñas no coinciden.')

        try:
            password_validation.validate_password(password)
        except ValidationError as exc:
            raise CommandError(f'La contraseña no cumple los requisitos: {exc}') from exc

        user = User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
            first_name='Administrador',
            last_name='Vialtros',
            role='admin',
        )
        self.stdout.write(self.style.SUCCESS(f'Cuenta de administrador creada: {user.username}'))
        self.stdout.write('Guarda las credenciales en tu gestor seguro; no se imprimió la contraseña.')
