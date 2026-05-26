from django.db import models
from django.utils import timezone


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
    criada_em = models.DateTimeField(auto_now_add=True)
    concluida_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-data', '-criada_em']

    def __str__(self):
        return self.titulo
