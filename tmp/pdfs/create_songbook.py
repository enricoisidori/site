from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
out='output/pdf/stella-mia-piccolo-canzoniere.pdf'
font='/System/Library/Fonts/Supplemental/Arial.ttf'
bold='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
pdfmetrics.registerFont(TTFont('Text',font)); pdfmetrics.registerFont(TTFont('Bold',bold))
c=canvas.Canvas(out,pagesize=A4); w,h=A4
c.setTitle('Stella mia [outro] - Piccolo | Testo e accordi indicativi')
ink=HexColor('#192431'); blue=HexColor('#285C83'); muted=HexColor('#677381')
def text(x,y,s,size=10,font='Text',color=ink):
 c.setFillColor(color); c.setFont(font,size); c.drawString(x,y,s)
def header(section,page):
 text(43,h-48,'PICCOLO',10,'Bold',blue)
 text(43,h-77,'Stella mia [outro]',25,'Bold')
 text(43,h-99,'Testo e accordi • Versione di studio semplificata',10,color=muted)
 c.setStrokeColor(HexColor('#DCE3E9')); c.line(43,h-113,w-43,h-113)
 text(43,h-137,section,12,'Bold')
 text(43,27,'Allineamento indicativo: i cambi sulle parole non sono verificati all’ascolto.',8,color=muted)
 text(w-61,27,str(page),8,color=muted)
def row(y,lyric,chords):
 for offset,chord in chords: text(43+offset,y,chord,10,'Bold',blue)
 text(43,y-13,lyric,10)
header('STROFA',1)
rows=[
('Stella mia',[(0,'Mim')]),
('Indica tu la strada',[(0,'Re')]),
('Che io non so più dove andare',[(0,'Do7+')]),
('Che non so più dove',[(0,'Do7+')]),
("È l'ombra del passato che mi toglie il sonno",[(0,'Mim'),(145,'La')]),
('Che mi toglie il sonno, che mi toglie il sonno',[(0,'Do7+')]),
("È l'ombra dei palazzi che ci toglie il sole",[(0,'Mim'),(142,'La')]),
('Che ci toglie il sole, che ci toglie il sole',[(0,'Do7+')]),
('Ed è strano quanto mi fai stare bene',[(0,'Mim'),(113,'La')]),
('Quella cosa che hai sciolto nel bicchiere',[(0,'Do7+')]),
('Ed è strano quanto mi fai stare bene (Stare bene)',[(0,'Mim'),(113,'La')]),
("Sembra assurdo, ma è un'altra notte insieme",[(0,'Do7+')]),
("Sembra assurdo, ma è un'altra notte di miele",[(0,'Mim'),(145,'La')]),
("Mi vergogno un po', ma le droghe e gli oppiacei",[(0,'Do7+')]),
('Mi distraggono da questo mondo infame',[(0,'Mim'),(124,'La')]),
("Mi vergogno un po', ma rubare mi piace",[(0,'Do7+')]),
('E il tuo cuore è già qua dentro la mia mano',[(0,'Mim'),(133,'La')]),
('Dentro la mia tasca, dentro la mia giacca a vento',[(0,'Do7+')]),
('Dentro la mia mano, dentro la mia tasca, dove non arriva il vento',[(0,'Mim'),(185,'La')]),
('Che ora soffia forte nelle mie vene (Nelle mie vene)',[(0,'Do7+')]),
('Tu sei dolce, ma inietti tutto il veleno (Tutto il veleno)',[(0,'Mim'),(127,'La')]),
('Che ora scorre forte nelle mie vene',[(0,'Do7+')]),
("Sembra assurdo ma è un'altra notte insieme",[(0,'Mim'),(137,'La')]),
("Sembra assurdo ma è un'altra notte di miele",[(0,'Do7+')]),
]
y=h-162
for lyric,chords in rows: row(y,lyric,chords); y-=25
c.showPage(); header('OUTRO',2)
rows2=[('Stella mia',[(0,'Sib')]),('Indica tu la strada',[(0,'Do')]),('Che io non so più dove andare',[(0,'Re')]),('Dove andare, dove andare',[(0,'Re')]),('Che non so più dove stare',[(0,'Sib')]),('Dove stare, dove stare',[(0,'Do')]),('Che non so più dove andare',[(0,'Re')]),('Dove andare, dove andare',[(0,'Re')]),('Che non so più...',[(0,'Re')])]
y=h-166
for lyric,chords in rows2: row(y,lyric,chords); y-=32
text(43,y-22,'COME LEGGERE QUESTA VERSIONE',10,'Bold',blue)
notes=[
'Gli accordi sopra le righe sono una proposta di accompagnamento,',
'non una trascrizione certificata dei cambi sulle singole parole.',
'Chordify riporta Mim, La, Do7+ e Re come accordi principali.',
'La sua griglia inizia con Mim - Re - Do7+ e prosegue soprattutto',
'con Mim - La - Do7+. Nel finale compaiono anche Mi, Sib, Fa e Rem.',
'Qui il finale è ridotto a Sib - Do - Re: verifica gli ingressi sulla registrazione.',
'Do7+ = Cmaj7 (Do maggiore settima); Sib = Bb; Mim = Em.',
]
for n in notes: y-=15; text(43,y-29,n,9,color=muted)
y-=70
text(43,y,'FONTI',10,'Bold',blue)
text(43,y-19,'Accordi: Chordify - Piccolo, Stella mia [outro]',9)
c.linkURL('https://chordify.net/it/chords/stella-mia-outro-piccolo-topic',(43,y-22,340,y-8),relative=0)
text(43,y-35,'Testo: fornito dall’utente, da Genius; rimossi annunci e suggerimenti.',9)
c.linkURL('https://genius.com/Piccolo-stella-mia-outro-lyrics',(43,y-39,495,y-24),relative=0)
c.save()
print(os.path.abspath(out))
