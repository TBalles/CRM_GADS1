-- CRM GADS1 - datos precargados
-- Etapas del embudo y catalogo inicial de productos/servicios.

insert into public.etapas (nombre, orden, color) values
  ('Nuevo', 1, '#94a3b8'),
  ('Calificación', 2, '#60a5fa'),
  ('Propuesta Enviada', 3, '#fbbf24'),
  ('Negociación', 4, '#fb923c'),
  ('Ganada', 5, '#4ade80'),
  ('Perdida', 6, '#f87171')
on conflict (orden) do nothing;

insert into public.productos (nombre, descripcion, precio, categoria) values
  ('Arco de fútbol 11 (7.32 x 2.44 m)', 'Arco reglamentario para cancha de fútbol 11, caño estructural', 450000, 'Arcos'),
  ('Arco de fútbol 5/7', 'Arco para fútbol reducido, aluminio o caño', 180000, 'Arcos'),
  ('Red para arco de fútbol 11', 'Red de nylon reforzada, juego x 2 unidades', 65000, 'Redes'),
  ('Red para arco de fútbol 5/7', 'Red de nylon, juego x 2 unidades', 32000, 'Redes'),
  ('Set de conos de entrenamiento x 50', 'Conos de PVC 23cm, colores surtidos', 28000, 'Entrenamiento'),
  ('Vallas de entrenamiento (juego x 6)', 'Vallas plegables regulables en altura', 45000, 'Entrenamiento'),
  ('Escalera y aros de agilidad', 'Kit de entrenamiento de velocidad y coordinación', 22000, 'Entrenamiento'),
  ('Pecheras de entrenamiento x 15 (juego)', 'Pecheras de malla, talles adulto', 38000, 'Indumentaria'),
  ('Pelota de fútbol N°5 (unidad)', 'Pelota reglamentaria cosida a máquina', 15000, 'Pelotas'),
  ('Pelota de fútbol N°4 (unidad)', 'Pelota para fútbol infantil/juvenil', 12000, 'Pelotas'),
  ('Banderines de córner (juego x 4)', 'Banderines con base flexible reglamentarios', 9000, 'Accesorios'),
  ('Kit de mantenimiento de cancha', 'Rastrillo, marcador de líneas y accesorios', 95000, 'Mantenimiento')
on conflict (nombre) do nothing;
