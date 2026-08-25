import pymupdf
import re

SOURCE, OUTPUT = 'cv.pdf', 'cv_en.pdf'
BOOK = '/Users/enrico/Library/Fonts/SuisseIntl-Book.ttf'
ITALIC = '/Users/enrico/Library/Fonts/SuisseIntl-BookIt.ttf'

# The source PDF is retained as the canvas. Replaced spans keep their original
# baseline, point size, font face and every non-text element (including rules).
REPLACEMENTS = {
    'Nome': 'Name', 'Mail': 'Email', 'Sito': 'Website', 'Bio': 'Profile', 'Base': 'Location',
    'Esperienza lavorativa': 'Professional experience', 'Insegnamento': 'Teaching',
    'Pubblicazioni accademiche': 'Academic publications', 'Convegni': 'Conferences',
    'Esposizioni': 'Exhibitions', 'Istruzione': 'Education', 'Riconoscimenti': 'Awards and recognition',
    'Conoscenze linguistiche': 'Language skills', 'Attività': 'Activities', 'Presso': 'At',
    'Progetto selezionato': 'Selected project', 'Progetti selezionati': 'Selected projects',
    'Progetto installativo': 'Installation project', 'Progetto editoriale': 'Editorial project',
    'Progetto di ricerca': 'Research project', 'Progetto': 'Project', 'Mostra': 'Exhibition',
    'Con': 'With', 'Spazi': 'Venues', 'Spazio': 'Venue', 'Sezione': 'Section',
    'Ambito': 'Field', 'Docenti': 'Faculty', 'Corsi': 'Courses', 'Contributo': 'Contribution',
    'Contributi': 'Contributions', 'Aree di studio': 'Areas of study', 'Durata': 'Duration',
    'Voto': 'Grade', 'Titolo': 'Title', 'Relatore': 'Supervisor', 'Contesto': 'Context',
    'Certificazioni': 'Certifications', 'Lingua inglese': 'English language',
    'Lingua francese': 'French language', 'Lingua italiana': 'Italian language',
    'Lettura': 'Reading', 'Scrittura': 'Writing', 'Parlato': 'Speaking',
    'avanzato': 'Advanced', 'base': 'Basic', 'Madrelingua': 'Native speaker',
    '2026 — in corso': '2026 — present', 'Settembre 2023 — in corso': 'September 2023 — present',
    'Marzo — luglio 2026': 'March — July 2026', 'Agosto 2025': 'August 2025',
    '25 giugno 2026': '25 June 2026', '3 — 7 giugno 2025': '3 — 7 June 2025',
    '9 — 11 maggio 2024': '9 — 11 May 2024', '15 febbraio 2026': '15 February 2026',
    '15 marzo 2025': '15 March 2025', '3 — 6 luglio 2025': '3 — 6 July 2025',
    '12 — 14 giugno 2025': '12 — 14 June 2025', '7 — 11 maggio 2025': '7 — 11 May 2025',
    '8 — 13 aprile 2025': '8 — 13 April 2025', '9 aprile — 29 maggio 2025': '9 April — 29 May 2025',
    '25 febbraio — 9 marzo 2025': '25 February — 9 March 2025', '16 — 21 aprile 2024': '16 — 21 April 2024',
    '22 marzo 2023': '22 March 2023', '17 — 18 settembre 2022': '17 — 18 September 2022',
    '30 maggio — 1 giugno 2022': '30 May — 1 June 2022', 'Novembre 2024': 'November 2024',
    'Maggio 2024': 'May 2024', 'Novembre 2023': 'November 2023', 'Settembre 2022': 'September 2022',
    'Milano, luglio 2026': 'Milan, July 2026',
    'Designer freelance': 'Freelance designer', 'Designer interdisciplinare': 'Interdisciplinary designer',
    'Docente': 'Lecturer', 'Formatore': 'Trainer', 'Assistente alla didattica': 'Teaching assistant',
    'Designer, ricercatore e artista che lavora tra visual, critical ed experiential, attraverso approcci non disciplinari e ': 'Designer, researcher and artist working across visual, critical and experiential design through non-disciplinary approaches and ',
    'processi non lineari.': 'non-linear processes.',
    'Progettazione e ricerca nell’ambito del graphic, exhibition, information design.': 'Design and research in graphic, exhibition and information design.',
    'Progetti di ricerca, installazioni interattive, allestimenti, arti performative e digitali': 'Research projects, interactive installations, exhibition design, performing and digital arts',
    'Studio e associazione impegnate nello sviluppo di progetti sul rapporto tra ': 'Studio and association developing projects on the relationship between ',
    'intelligenze umane e artificiali, con l’obiettivo di promuovere il dialogo tra arte, ': 'human and artificial intelligences, fostering dialogue among art, ',
    'tecnologia e società.': 'technology and society.',
    'Studio con approccio sintetico al design, alla tecnologia e alla comunicazione strategica, orientato alla ': 'Studio with a multidisciplinary approach to design, technology and strategic communication, focused on ',
    'realizzazione di sistemi interattivi, identità di marca e piattaforme cross-mediali. ': 'creating interactive systems, brand identities and cross-media platforms. ',
    'Applicazioni Digitali per l’Arte (Data Visualization), Communication and Creative ': 'Digital Applications for Art (Data Visualization), Communication and Creative ',
    'Technologies, IED, Torino.': 'Technologies, IED, Turin.',
    '–  Lezioni teoriche e didattica laboratoriale': '– Theoretical lectures and studio teaching',
    '–  Revisione dei progetti': '– Project reviews',
    '–  Co-progettazione e sviluppo iterativo dei progetti': '– Co-design and iterative project development',
}

WORDS = {
 'Studio':'Studio','associazione':'association','impegnate':'engaged','nello':'in the','sviluppo':'development','progetti':'projects','rapporto':'relationship','tra':'between','intelligenze':'intelligences','umane':'human','artificiali':'artificial','obiettivo':'aim','promuovere':'promote','dialogo':'dialogue','arte':'art','tecnologia':'technology','società':'society','con':'with','approccio':'approach','sintetico':'multidisciplinary','alla':'to','comunicazione':'communication','strategica':'strategic','orientato':'focused','realizzazione':'creation','sistemi':'systems','interattivi':'interactive','identità':'identities','marca':'brand','piattaforme':'platforms','dedicata':'dedicated','formazione':'training','uso':'use','creativo':'creative','critico':'critical','intelligenza':'intelligence','artificiale':'artificial','Sviluppo':'Development','conduzione':'delivery','lezioni':'lessons','teorico-pratiche':'theoretical-practical','corsi':'courses','Laboratorio':'Laboratory','Sintesi':'Synthesis','Finale':'Final','della':'of the','Politecnico':'Politecnico','Milano':'Milan','Supporto':'Support','didattica':'teaching','laboratoriale':'studio','frontale':'lecture-based','studenti':'students','durante':'during','valutazione':'assessment','ricerca':'research','corredo':'supporting','esperienze':'experiences','Curatela':'Curatorship','coordinamento':'coordination','espositivi':'exhibition','progetti':'projects','Attività':'Activities','Progetto':'Project','Mostra':'Exhibition','Partecipazione':'Participation','qualità':'role','espositore':'exhibitor','autore':'author','internazionale':'international','dedicato':'dedicated','dedicata':'dedicated','mostre':'exhibitions','installazioni':'installations','arte':'art','design':'design','innovazione':'innovation','attraverso':'through','e':'and','il':'the','la':'the','le':'the','di':'of','in':'in','per':'for','sul':'on the','del':'of the','delle':'of the','dei':'of the','agli':'to the','non':'non','umano':'human','umana':'human','nuovi':'new','linguaggi':'languages','selezione':'selection','pubblicazione':'publication','premio':'award','rassegna':'exhibition','contemporanea':'contemporary','italiana':'Italian','italiano':'Italian','avanzato':'Advanced','base':'Basic'
}
def rough_translate(text):
    if text in REPLACEMENTS: return REPLACEMENTS[text]
    def sub(m):
        w=m.group(0); return WORDS.get(w, WORDS.get(w.lower(), w))
    return re.sub(r"[A-Za-zÀ-ÖØ-öø-ÿ’'-]+", sub, text)

doc = pymupdf.open(SOURCE)
for page in doc:
    replacements=[]
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                raw = span['text'].strip()
                new = rough_translate(raw)
                if new != raw:
                    replacements.append((span, new))
    for span, new in replacements:
        rect = pymupdf.Rect(span['bbox'])
        rect.x1 += 2
        page.draw_rect(rect, color=None, fill=(1, 1, 1), overlay=True)
        font = ITALIC if 'It' in span['font'] else BOOK
        page.insert_text(span['origin'], new, fontfile=font, fontsize=span['size'], color=(0, 0, 0), overlay=True)
doc.save(OUTPUT, garbage=4, deflate=True)
