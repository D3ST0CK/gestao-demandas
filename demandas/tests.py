from django.test import TestCase
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from .models import Setor, Pessoa, Demanda


class DemandaQueryCountTests(TestCase):
    """Garante que listar nao escala com o numero de linhas (sem N+1)."""

    def setUp(self):
        self.user = User.objects.create_user('tester', password='x')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.setor = Setor.objects.create(nome='TI')
        self.pessoas = [Pessoa.objects.create(nome=f'P{i}', setor=self.setor) for i in range(10)]
        for i in range(10):
            Demanda.objects.create(
                titulo=f'D{i}', categoria='suporte', responsavel=self.pessoas[i]
            )

    def test_list_demandas_sem_nplus1(self):
        with CaptureQueriesContext(connection) as ctx:
            resp = self.client.get('/api/demandas/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 10)
        self.assertLessEqual(
            len(ctx), 1,
            f"N+1 detectado: {len(ctx)} queries para listar 10 demandas (esperado <=1)",
        )

    def test_list_setores_sem_nplus1(self):
        with CaptureQueriesContext(connection) as ctx:
            resp = self.client.get('/api/setores/')
        self.assertEqual(resp.status_code, 200)
        self.assertLessEqual(
            len(ctx), 2,
            f"N+1 detectado em setores: {len(ctx)} queries (esperado <=2)",
        )
