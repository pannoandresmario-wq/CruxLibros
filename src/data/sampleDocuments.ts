import { DocumentItem } from '../types';

export const INITIAL_SAMPLE_DOCS: DocumentItem[] = [
  {
    id: 'sample-martin-fierro',
    title: 'Martín Fierro — José Hernández (Canto I: Versos del Gaucho Payador)',
    sourceType: 'text',
    content: `Aquí me pongo a cantar,
al compás de la vigüela,
que el hombre que lo desvela
una pena estraordinaria,
como la ave solitaria
con el cantar se consuela.

Pido a los Santos del Cielo
que ayuden mi pensamiento;
les pido en este momento
que voy a cantar mi historia
me refresquen la memoria
y aclaren mi entendimiento.

Vengan Santos milagrosos,
vengan todos en mi ayuda,
que la lengua se me añuda
y se me turba la vista;
pido a Dios que me asista
en una ocasión tan ruda.

Yo he visto muchos cantores,
con famas bien obtenidas,
y que después de adquiridas
no las quieren sustentar:
parece que sin largar
se cansaron en partidas.

Cantando me he de morir,
cantando me han de enterrar,
y cantando he de llegar
al pie del Eterno Padre:
dende el vientre de mi madre
vine a este mundo a cantar.

Que no se trabe mi lengua
ni me falte la palabra;
el cantar mi gloria labra
y, poniéndome a cantar,
cantando me han de encontrar
aunque la tierra se abra.`,
    paragraphs: [
      `Aquí me pongo a cantar,
al compás de la vigüela,
que el hombre que lo desvela
una pena estraordinaria,
como la ave solitaria
con el cantar se consuela.`,
      `Pido a los Santos del Cielo
que ayuden mi pensamiento;
les pido en este momento
que voy a cantar mi historia
me refresquen la memoria
y aclaren mi entendimiento.`,
      `Vengan Santos milagrosos,
vengan todos en mi ayuda,
que la lengua se me añuda
y se me turba la vista;
pido a Dios que me asista
en una ocasión tan ruda.`,
      `Yo he visto muchos cantores,
con famas bien obtenidas,
y que después de adquiridas
no las quieren sustentar:
parece que sin largar
se cansaron en partidas.`,
      `Cantando me he de morir,
cantando me han de enterrar,
y cantando he de llegar
al pie del Eterno Padre:
dende el vientre de mi madre
vine a este mundo a cantar.`,
      `Que no se trabe mi lengua
ni me falte la palabra;
el cantar mi gloria labra
y, poniéndome a cantar,
cantando me han de encontrar
aunque la tierra se abra.`
    ],
    wordCount: 172,
    readingTimeMinutes: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentParagraphIndex: 0,
    currentSentenceIndex: 0,
    percentRead: 0,
    lastReadAt: new Date().toISOString(),
    bookmarks: [],
    summaries: {
      executive: 'El Canto I del Martín Fierro es la invocación poética por excelencia del gaucho payador pampeano. Al compás de la guitarra criolla (la vigüela), Fierro pide auxilio divino a los santos para esclarecer su memoria e iniciar el relato de sus penas y su vida en la pampa.',
      bullets: '• Invocación al canto y la guitarra criolla como bálsamo del alma solitaria.\n• Plegaria a los santos para que guíen su pensamiento y memoria.\n• Declaración de identidad: cantor errante que desde el vientre materno nació para versar con temple.'
    }
  },
  {
    id: 'sample-sun-tzu',
    title: 'El Arte de la Guerra — Sun Tzu (Capítulo I: De los Planes)',
    sourceType: 'text',
    content: `Sun Tzu dice: La guerra es de vital importancia para el Estado; es el dominio de la vida o de la muerte, el camino hacia la supervivencia o la pérdida del imperio: es forzoso manejarla bien. No reflexionar seriamente sobre todo lo que le concierne es dar prueba de una culpable indiferencia en lo que respecta a la conservación o pérdida de lo que nos es más querido, y ello no debe ocurrir entre nosotros.

Hay que valorarla en términos de cinco factores fundamentales, y hacer comparaciones entre diversas condiciones de los bandos rivales, con vistas a determinar el resultado de la contienda. Estos factores son: la Doctrina, el Tiempo, el Terreno, el Mando y la Disciplina.

La Doctrina significa aquello que hace que el pueblo esté en completa armonía con su gobernante, de modo que le siga a donde sea, sin temer por sus vidas ni titubear ante ningún peligro.

El Tiempo significa el frío y el calor, el día y la noche, el cambio de las estaciones, las brisas y los vientos.

El Terreno implica las distancias, y hace referencia a dónde es fácil o difícil desplazarse; si es campo abierto o lugares estrechos, y la influencia que esto tiene en las posibilidades de supervivencia.

El Mando ha de tener como cualidades: sabiduría, sinceridad, benevolencia, coraje y severidad. Tener sabiduría permite reconocer el cambio de las circunstancias y actuar rápidamente según convenga.

La Disciplina ha de ser entendida como la organización del ejército, las graduaciones y rangos entre los oficiales, la regulación de las rutas de suministros, y la provisión de material logístico al ejército.

Todo general debe estar familiarizado con estos cinco elementos. Aquel que los domina, vence; aquel que no, fracasa. Por lo tanto, al trazar los planes, han de compararse los siguientes siete factores, valorando cada uno con el mayor cuidado: ¿Qué dirigente es más sabio y capaz? ¿Qué comandante posee el mayor talento militar? ¿Qué ejército obtiene ventajas de la naturaleza y el terreno? ¿En qué bando se ejecutan mejor las leyes y órdenes? ¿Qué tropas son más fuertes y disciplinadas? ¿Qué oficiales y soldados están mejor entrenados? ¿Dónde se aplican las recompensas y castigos de manera más justa? Mediante el estudio de estos siete elementos, uno puede prever con certeza la victoria o la derrota.`,
    paragraphs: [
      'Sun Tzu dice: La guerra es de vital importancia para el Estado; es el dominio de la vida o de la muerte, el camino hacia la supervivencia o la pérdida del imperio: es forzoso manejarla bien. No reflexionar seriamente sobre todo lo que le concierne es dar prueba de una culpable indiferencia en lo que respecta a la conservación o pérdida de lo que nos es más querido, y ello no debe ocurrir entre nosotros.',
      'Hay que valorarla en términos de cinco factores fundamentales, y hacer comparaciones entre diversas condiciones de los bandos rivales, con vistas a determinar el resultado de la contienda. Estos factores son: la Doctrina, el Tiempo, el Terreno, el Mando y la Disciplina.',
      'La Doctrina significa aquello que hace que el pueblo esté en completa armonía con su gobernante, de modo que le siga a donde sea, sin temer por sus vidas ni titubear ante ningún peligro.',
      'El Tiempo significa el frío y el calor, el día y la noche, el cambio de las estaciones, las brisas y los vientos.',
      'El Terreno implica las distancias, y hace referencia a dónde es fácil o difícil desplazarse; si es campo abierto o lugares estrechos, y la influencia que esto tiene en las posibilidades de supervivencia.',
      'El Mando ha de tener como cualidades: sabiduría, sinceridad, benevolencia, coraje y severidad. Tener sabiduría permite reconocer el cambio de las circunstancias y actuar rápidamente según convenga.',
      'La Disciplina ha de ser entendida como la organización del ejército, las graduaciones y rangos entre los oficiales, la regulación de las rutas de suministros, y la provisión de material logístico al ejército.',
      'Todo general debe estar familiarizado con estos cinco elementos. Aquel que los domina, vence; aquel que no, fracasa. Por lo tanto, al trazar los planes, han de compararse los siguientes siete factores, valorando cada uno con el mayor cuidado: ¿Qué dirigente es más sabio y capaz? ¿Qué comandante posee el mayor talento militar? ¿Qué ejército obtiene ventajas de la naturaleza y el terreno? ¿En qué bando se ejecutan mejor las leyes y órdenes? ¿Qué tropas son más fuertes y disciplinadas? ¿Qué oficiales y soldados están mejor entrenados? ¿Dónde se aplican las recompensas y castigos de manera más justa? Mediante el estudio de estos siete elementos, uno puede prever con certeza la victoria o la derrota.'
    ],
    wordCount: 395,
    readingTimeMinutes: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentParagraphIndex: 0,
    currentSentenceIndex: 0,
    percentRead: 0,
    lastReadAt: new Date().toISOString(),
    bookmarks: [],
    summaries: {
      executive: 'Sun Tzu establece que la guerra es una cuestión de supervivencia nacional que exige un análisis riguroso y metódico. Define cinco factores esenciales de evaluación (Doctrina, Tiempo, Terreno, Mando y Disciplina) y siete interrogantes comparativos fundamentales que permiten predecir el desenlace de cualquier contienda antes del combate.',
      bullets: '• La estrategia militar es asunto de vida o muerte para el Estado; no admite ligerezas.\n• Los cinco pilares: Doctrina (cohesión moral), Tiempo (clima y estacionalidad), Terreno (espacio y relieve), Mando (liderazgo sabio y severo) y Disciplina (logística y rango).\n• El cálculo comparativo previo entre las capacidades de ambos bandos garantiza la previsión objetiva de la victoria o el fracaso.'
    }
  },
  {
    id: 'sample-ai-neuroscience',
    title: 'La Frontera entre la Inteligencia Artificial y la Cognición Humana',
    sourceType: 'text',
    content: `A medida que los modelos multimodales y las redes neuronales profundas alcanzan hitos extraordinarios en el procesamiento del lenguaje y la generación de conocimiento, resurge una pregunta milenaria: ¿qué distingue fundamentalmente la cognición biológica del cómputo sintético?

La neurociencia contemporánea nos enseña que el cerebro humano no opera como una simple máquina de predicción estadística pasiva. Por el contrario, es un órgano encarnado, profundamente anclado en la homeostasis, las emociones viscerales y la interacción motora continua con el entorno físico. La consciencia y el sentido de significación surgen de esta danza ininterrumpida entre el cuerpo biológico y el mundo exterior.

Por su parte, los modelos de lenguaje a gran escala demuestran una capacidad sin precedentes para comprimir y sintetizar el patrimonio cultural humano. Su fuerza reside en la generalización semántica y en la agilidad para interconectar conceptos dispares a través de billones de parámetros matemáticos.

La confluencia entre ambas disciplinas no debe verse como una carrera de reemplazo, sino como una alianza simbiótica. Al igual que el telescopio expandió la vista humana hacia los confines del cosmos, las herramientas de inteligencia artificial están ampliando la capacidad cognitiva humana para descifrar problemas planetarios, desde el diseño de fármacos hasta la comprensión de los sistemas ecológicos globales.`,
    paragraphs: [
      'A medida que los modelos multimodales y las redes neuronales profundas alcanzan hitos extraordinarios en el procesamiento del lenguaje y la generación de conocimiento, resurge una pregunta milenaria: ¿qué distingue fundamentalmente la cognición biológica del cómputo sintético?',
      'La neurociencia contemporánea nos enseña que el cerebro humano no opera como una simple máquina de predicción estadística pasiva. Por el contrario, es un órgano encarnado, profundamente anclado en la homeostasis, las emociones viscerales y la interacción motora continua con el entorno físico. La consciencia y el sentido de significación surgen de esta danza ininterrumpida entre el cuerpo biológico y el mundo exterior.',
      'Por su parte, los modelos de lenguaje a gran escala demuestran una capacidad sin precedentes para comprimir y sintetizar el patrimonio cultural humano. Su fuerza reside en la generalización semántica y en la agilidad para interconectar conceptos dispares a través de billones de parámetros matemáticos.',
      'La confluencia entre ambas disciplinas no debe verse como una carrera de reemplazo, sino como una alianza simbiótica. Al igual que el telescopio expandió la vista humana hacia los confines del cosmos, las herramientas de inteligencia artificial están ampliando la capacidad cognitiva humana para descifrar problemas planetarios, desde el diseño de fármacos hasta la comprensión de los sistemas ecológicos globales.'
    ],
    wordCount: 224,
    readingTimeMinutes: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentParagraphIndex: 0,
    currentSentenceIndex: 0,
    percentRead: 0,
    lastReadAt: new Date().toISOString(),
    bookmarks: [],
    summaries: {
      executive: 'El artículo analiza la distinción entre la mente biológica encarnada y el cómputo de la IA. Propone que el cerebro humano se nutre de la homeostasis corporal y las emociones, mientras que la IA destaca en síntesis y compresión semántica a escala. Concluye que la relación ideal es una simbiosis colaborativa de amplificación cognitiva.'
    }
  }
];
