from django.db import models
from django.utils import timezone


class Setor(models.Model):
    nome = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ['nome']

    def __str__(self):
        return self.nome


class Pessoa(models.Model):
    nome = models.CharField(max_length=150)
    setor = models.ForeignKey(Setor, on_delete=models.CASCADE, related_name='pessoas')

    class Meta:
        ordering = ['nome']

    def __str__(self):
        return self.nome


class Demanda(models.Model):
    CATEGORIA_CHOICES = [
        ('suporte', 'Suporte'),
        ('tecnico', 'Técnico'),
        ('rotina', 'Rotina'),
    ]
    STATUS_CHOICES = [
        ('aberta', 'Aberta'),
        ('andamento', 'Em andamento'),
        ('concluida', 'Concluída'),
    ]

    titulo = models.CharField(max_length=200)
    categoria = models.CharField(max_length=20, choices=CATEGORIA_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='aberta')
    data = models.DateField(default=timezone.localdate)
    responsavel = models.ForeignKey(Pessoa, null=True, blank=True, on_delete=models.SET_NULL, related_name='demandas')
    criada_em = models.DateTimeField(auto_now_add=True)
    concluida_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-data', '-criada_em']

    def __str__(self):
        return self.titulo
