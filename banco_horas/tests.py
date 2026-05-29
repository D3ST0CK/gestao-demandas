from django.test import TestCase
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from demandas.models import Setor, Pessoa, Demanda
from .models import EntradaBancoHoras


class DashboardQueryCountTests(TestCase):
    """O dashboard nao pode disparar dezenas de queries sequenciais."""

    def setUp(self):
        self.user = User.objects.create_user('tester', password='x')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        setor = Setor.objects.create(nome='TI')
        pessoa = Pessoa.objects.create(nome='Alice', setor=setor)
        for i in range(10):
            Demanda.objects.create(
                titulo=f'D{i}', categoria='suporte', status='aberta', responsavel=pessoa
            )
        EntradaBancoHoras.objects.create(data='2026-05-01', horas=8, tipo='credito', descricao='x')
        EntradaBancoHoras.objects.create(data='2026-05-02', horas=2, tipo='debito', descricao='y')

    def test_dashboard_queries_limitadas(self):
        with CaptureQueriesContext(connection) as ctx:
            resp = self.client.get('/api/dashboard/')
        self.assertEqual(resp.status_code, 200)
        self.assertLessEqual(
            len(ctx), 4,
            f"Dashboard fazendo queries demais: {len(ctx)} (esperado <=4)",
        )

    def test_dashboard_shape_preservado(self):
        resp = self.client.get('/api/dashboard/')
        self.assertEqual(resp.status_code, 200)
        for key in [
            'demandas_abertas', 'em_andamento', 'concluidas', 'total',
            'taxa_conclusao', 'por_categoria', 'saldo_banco_horas',
            'recentes', 'por_dia', 'por_semana',
        ]:
            self.assertIn(key, resp.data, f"chave ausente no dashboard: {key}")
        # por_categoria precisa manter as 3 categorias
        self.assertEqual(set(resp.data['por_categoria'].keys()), {'suporte', 'tecnico', 'rotina'})


class HealthCheckTests(TestCase):
    """O /health/ deve responder 200 sem autenticacao (keep-alive)."""

    def test_health_sem_auth(self):
        resp = APIClient().get('/health/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, {'status': 'ok'})
