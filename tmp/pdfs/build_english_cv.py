from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
import os

OUT = 'output/pdf/CV_Isidori_EN.pdf'
W, H = A4
# Measurements match the source A4 PDF (not its raster preview).
M, LEFT, MAIN, RIGHT = 28.3, 141.6, 240.5, 567.0
FONT, ITALIC = 'Helvetica', 'Helvetica-Oblique'
SIZE, LEAD = 8.5, 11.0

os.makedirs(os.path.dirname(OUT), exist_ok=True)
c = canvas.Canvas(OUT, pagesize=A4)

def text_lines(txt, width, font=FONT, size=SIZE):
    lines=[]
    for paragraph in txt.split('\n'):
        words=paragraph.split()
        line=''
        for word in words:
            candidate=(line+' '+word).strip()
            if line and stringWidth(candidate,font,size)>width:
                lines.append(line); line=word
            else: line=candidate
        lines.append(line)
    return lines

def draw_lines(x, y, lines, font=FONT, size=SIZE, lead=LEAD):
    c.setFont(font,size)
    for line in lines:
        c.drawString(x,y,line); y-=lead
    return y

def section(y, title):
    c.setFont(FONT,8.5); c.drawString(M,y,title)
    c.setLineWidth(.45); c.line(M,y-11,RIGHT,y-11)
    return y-23

def row(y, date, title, details=[], desc=None, gap=11):
    # details items are (label, value, italic)
    c.setFont(FONT,SIZE); c.drawString(M,y,date)
    title_lines=text_lines(title,RIGHT-LEFT)
    draw_lines(LEFT,y,title_lines)
    content_y=y-len(title_lines)*LEAD
    if desc:
        content_y=draw_lines(LEFT,content_y,text_lines(desc,RIGHT-LEFT))
    for label,value,italic in details:
        c.setFont(FONT,SIZE); c.drawString(LEFT,content_y,label)
        value_lines=text_lines(value,RIGHT-MAIN,ITALIC if italic else FONT)
        draw_lines(MAIN,content_y,value_lines,ITALIC if italic else FONT)
        content_y-=max(1,len(value_lines))*LEAD
    return content_y-gap

def page1():
    y=H-30
    c.setFont(FONT,8.5); c.drawString(M,y,'Curriculum vitae'); c.line(M,y-11,RIGHT,y-11); y-=23
    top=[('Name','Enrico Isidori'),('Email','enrico.isidori@gmail.com'),('Website','enricoisidori.com'),('Instagram','@enrico.isidori'),('Profile','Designer, researcher, educator and artist. Works across communication, critical, interaction, information and exhibition design, with an interest in non-disciplinary approaches and non-linear design processes.'),('Location','Milan')]
    for lab,val in top:
        c.setFont(FONT,SIZE); c.drawString(M,y,lab); y=draw_lines(LEFT,y,text_lines(val,RIGHT-LEFT));
    y-=9; y=section(y,'Education')
    y=row(y,'2025','Master’s Degree in Communication Design, Politecnico di Milano, School of Design', [('Thesis','In progress, under the supervision of Prof. Francesco E. Guida.',False),('Grade','110/110',False),('Title','OFF-DISCIPLINE: Out-of-Place Design Condition',True),('Field','Unconventional methodologies, design approaches, non-linear processes, antidisciplinary, postdisciplinary',False),('Supervisor','Prof. Francesco E. Guida',False)],gap=12)
    y=row(y,'2024','Erasmus Programme at École Nationale Supérieure des Arts Appliqués et des Métiers d’Art, Paris',[('Areas of study','Typography, printing techniques, generative AI',False),('Duration','6 months',False)],gap=12)
    y=row(y,'2023','Bachelor’s Degree in Communication Design, Politecnico di Milano, School of Design',[('Grade','110/110 with honours',False),('Title','Specta: Your personal eco-anxiety silencer',True),('Field','Communication design, speculative design, interaction design, fictional branding, rapid prototyping, eco-anxiety, non-human, anti-biocentrism',False),('Context','Final Synthesis Laboratory C1',False),('Supervisor','Prof. Francesco E. Guida',False)],gap=12)
    y=row(y,'2020','Scientific High School Diploma, Liceo Bertrand Russell, Rome',[('Grade','100/100',False)],gap=15)
    y=section(y,'Publications')
    pubs=[('2026','Guida, F. E., & Isidori, E. (in press). Antidisciplinary communication design: A case of studio-based practice for producing embodied, explicit, and discursive knowledge. In Proceedings of the SID 2026 Annual Conference: Design Doing. Italian Society of Design.'),('2026','Guida, F. E., Isidori, E., & Tranti, C. (2026). Antidisciplinary design as epistemic resistance: Critical and political agency in communication design education. Progetto Grafico Journal, 23(42), 194–217. https://doi.org/10.82068/pgjournal.2026.23.42.08'),('2025','Esposito, M., Guida, F. E., Isidori, E., & Tranti, C. (2025). Conspiracy fiction as a tool for critical thinking: Designing embodied narratives based on conspiracy theories to reflect on contemporary issues and communication design. In Ethical Leadership: A New Frontier for Design (Cumulus Conference Proceedings Series, No. 14, pp. 1618–1634). Cumulus Association. https://hdl.handle.net/11311/1309667'),('2024','Esposito, M., Guida, F. E., Isidori, E., & Tranti, C. (2024). Anthropogenic narratives: Imagination and antidisciplinarity for the communication of non-human perspectives. In M. Bisson (Ed.), Environmental Design: Conference Proceedings of the 4th International Conference on Environmental Design (pp. 585–597). Palermo University Press. https://hdl.handle.net/11311/1267084')]
    for d,t in pubs: y=row(y,d,t,gap=10)
    y=section(y,'Conferences')
    y=row(y,'25 June 2026','Design Doing, Italian Society of Design, unibz, Bolzano',[('Contribution','Antidisciplinary communication design: A case of studio-based practice for producing embodied, explicit, and discursive knowledge.',True)],gap=10)
    y=row(y,'3–7 June 2025','Ethical Leadership: A New Frontier for Design, Cumulus Nantes 2025, Nantes',[('Contribution','Conspiracy Fiction as a Tool for Critical Thinking: Designing Narratives to Reflect on the Contemporary Information System',True)],gap=10)
    row(y,'9–11 May 2024','Environmental Design: 4th International Conference on Environmental Design, MDA, Ginosa',[('Contribution','Anthropogenic Narratives. Imagination and Anti-Disciplinarity for the Communication of Non-Human Perspectives',True)],gap=0)
    c.showPage()

def page2():
    # The source uses a denser setting on this text-heavy page.
    global SIZE, LEAD
    previous_size, previous_lead = SIZE, LEAD
    SIZE, LEAD = 7.4, 9.5
    y=H-30; y=section(y,'Lectures')
    y=row(y,'15 February 2026','Out-of-Place Discipline, Out-of-Phase Processes',[('Lecture at','Elisava, School of Design & Engineering with Post Computing Lab',False),('Contribution','OFF-DISCIPLINE: Out-of-Place Design Condition',True)],gap=12)
    y=row(y,'15 March 2025','Symposium on Antidisciplinary, Milan',[('Lecture and organisation','with Transmedia Research Institute and Final Synthesis Laboratory C1, Communication Design, Politecnico di Milano, in collaboration with 2050+ and Dotdotdot.',False),('Contributions','Anthropogenic Narratives. Imagination and Anti-Disciplinarity for the Communication of Non-Human Perspectives and Conspiracy Fiction as a Tool for Critical Thinking: Designing Narratives to Reflect on the Contemporary Information System',True)],gap=15)
    y=section(y,'Teaching experience')
    y=row(y,'March–July 2026','Lecturer',[('At','Digital Applications for Art (Data Visualization), Communication and Creative Technologies, IED, Turin.',False),('Field','Critical data design, information design, computational methods, communication design',False),('Faculty','Antonella Autuori',False),('Activities','– Theoretical lectures and studio teaching\n– Project reviews\n– Co-design and iterative project development',False)],gap=12)
    y=row(y,'September 2023–present','Teaching assistant',[('At','Final Synthesis Laboratory C1 (Antidisciplinary Communication Design Lab), Communication Design, Politecnico di Milano',False),('Field','Critical design, speculative design, interaction design, communication design, exhibition design',False),('Faculty','Francesco E. Guida, Pietro Buffa, Alessandro Masserdotti and Giacomo Scandolara',False),('Activities','– Support for studio and lecture-based teaching\n– Student tutoring during project development\n– Project review and assessment\n– Research activities supporting teaching experiences\n– Curatorship and coordination of the Laboratory’s exhibition projects:\n  Undeclared: Highlighting hidden conflicts through communication and speculative design, Dotdotdot, 2026\n  Anthropogenic Scenarios: Nature vs Human Matters – Narratives through Design, Salone Satellite, Salone del Mobile, 2025\n  Believe It or Not: Speculating on (un)real conspiracy theories, Dotdotdot, 2025\n  Raw Scenarios: Reflecting on human overconsumption, Dotdotdot, 2024',False)],gap=15)
    y=section(y,'Professional experience')
    y=row(y,'2026–present','Freelance designer',[('Activities','Design, research and consulting in graphic, exhibition, creative art direction, data-information, brand, editorial, web and motion design.',False)],gap=12)
    y=row(y,'2025–2026','Interdisciplinary designer',[('At','Operating System Studio and Umanesimo Artificiale',False),('Activities','Research projects, interactive installations, exhibition design, performing and digital arts',False),('Selected project','N+ Industries: Cognitive Supremacy (Videocittà 2025, Sónar +D 2025)',True)],'Studio and association developing projects on the relationship between human and artificial intelligences, with the aim of fostering dialogue among art, technology and society.',gap=12)
    y=row(y,'August 2025','Trainer',[('At','BridgeAI — Innovate UK',False),('Activities','Development and delivery of theoretical-practical lessons in online courses',False),('Courses','Prompt to Picture: Creating Images with AI\nPrompt to Motion: Creating Videos with AI',True)],'Platform dedicated to training in the creative and critical use of artificial intelligence.',gap=12)
    row(y,'2023–2024','Visual designer',[('At','Giga Design Studio, Milan',False),('Activities','Graphic design, web design, motion design, editorial design, visual identity',False),('Selected projects','Capsule Plaza, 6AM, The North Face, Bid(s) for Survival',False)],'Studio with a multidisciplinary approach to design, technology and strategic communication, focused on creating interactive systems, brand identities and cross-media platforms.',gap=0)
    c.showPage()
    SIZE, LEAD = previous_size, previous_lead

def page3():
    y=H-30; y=section(y,'Exhibitions')
    entries=[('3–6 July 2025','Videocittà, Agorà Expo, Rome','International festival dedicated to audiovisual media and moving images, a European reference point for digital art, technology and innovation through projections, immersive installations and performances.', [('Installation project','N+ Industries: Cognitive Supremacy',True),('With','Operating System Studio',False),('Activity','Participation as exhibitor',False)]),('12–14 June 2025','Sónar +D, Barcelona','Internationally renowned festival exploring digital innovation in design, art and electronic music through research and experimental projects.', [('Installation project','N+ Industries: Cognitive Supremacy',True),('With','Operating System Studio',False),('Activity','Participation as exhibitor',False)]),('7–11 May 2025','Bellaria Film Festival','Historic independent festival dedicated to audiovisual research, documentaries and experimental languages.', [('Section','Nature Watches Us — Three Minutes on a Fixed Theme',False),('Audiovisual project','You Never Look at Me Where I See You',True),('With','Guidone Apulia Factory',False),('Activity','Participation as author',False)]),('8–13 April 2025','Salone Satellite, Salone del Mobile, Rho','International event and leading platform for experimentation and innovation in the design sector.', [('Installation project','Specta — Your personal eco-anxiety silencer',True),('Exhibition','Anthropogenic Scenarios: Nature vs Human Matters: Narratives through Design',False),('With','Final Synthesis Laboratory C1, Communication Design, Politecnico di Milano',False),('Activity','Participation as exhibitor and exhibition-installation curator',False)]),('9 April–29 May 2025','DesignxDesigners, Fuorisalone, Milan','Group exhibition of educational projects held during Milan Design Week within the Fuorisalone circuit.', [('Project','Digital_Forest — Four years of human categorization of trail cam footage',True),('With','DensityDesign Lab',False),('Activity','Participation as exhibitor',False)])]
    for d,t,desc,details in entries: y=row(y,d,t,details,desc,gap=11)
    continuation=[('25 February–9 March 2025','MEET — Digital Culture Center, Milan','International centre for digital art and culture, dedicated to immersive exhibitions and multimedia experiences.', [('Installation project','Digital_Forest — Four years of human categorization of trail cam footage',True),('Exhibition','Liked, Trapped, Shared. Digital encounters with biodiversity',False),('With','DensityDesign Lab',False),('Activity','Participation as exhibitor',False)]),('16–21 April 2024','Fabbrica del Vapore, Milan','Cultural venue, within Design Week, hosting exhibitions, installations and art and design projects.', [('Exhibition','Interdependence — Designing Relationships',False),('With','Politecnico di Milano',False),('Project','Specta — Your personal eco-anxiety silencer',True),('Activity','Participation as exhibitor',False)]),('22 March 2023','Triennale Milano','International cultural institution dedicated to contemporary design, art and architecture.', [('Venue','Salone d’Onore',False),('Exhibition','Anthropogenic Narratives: Communicating and Experiencing Non-Human Perspectives',False),('Installation project','Specta — Your personal eco-anxiety silencer',True),('With','Final Synthesis Laboratory C1, Communication Design, Politecnico di Milano',False),('Activity','Participation as exhibitor and curator of the exhibition’s graphic design',False)]),('17–18 September 2022','Graphic Days, Turin','International festival dedicated to visual communication design, with exhibitions, workshops and installations exploring the role of graphics in contemporary culture.', [('Venues','Cavallerizza Reale, Docks Dora, Torino Print Club',False),('Exhibition','Neologia — New Languages of Visual Design in Italy',False),('Editorial project','Draw a line from one side of the page to the other',True),('Activity','Participation as exhibitor',False)]),('30 May–1 June 2022','ELO — International Conference on Electronic Literature, Como','International event dedicated to electronic literature and experimental writing practices.', [('Editorial project','Draw a line from one side of the page to the other',True),('Activity','Participation as exhibitor',False)])]
    for d,t,desc,details in continuation: y=row(y,d,t,details,desc,gap=11)
    c.showPage()

def page4():
    y=H-30; y=section(y,'Awards and recognition')
    awards=[('August 2025','Published on Contemporary Type','Platform and archive dedicated to contemporary typography; it collects and promotes innovative type-design projects internationally.', [('Editorial project','Rhytuals: Collective Rhythms',True)]),('2025–2026','Published on VisualBleed','International platform for research and development in art and design, promoting new creative narratives through exhibitions, editorial projects and collaborations.', [('Research project','OFF-DISCIPLINE: Out-of-Place Design Condition',True),('Installation project','N+ Industries: Cognitive Supremacy',True),('Editorial project','Rhytuals: Collective Rhythms',True)]),('November 2024','CDSA Awards — International Media Art Creativity Competition, Hangzhou','International media-art award organised by the China Academy of Art.', [('Project','Specta — Your personal eco-anxiety silencer',True)]),('May 2024','Published on Pittogramma','Italian graphic-design platform promoting young talent and emerging projects.', [('Project','Specta — Your personal eco-anxiety silencer',True)]),('November 2023','Published on Gpu Gallery','Showcase dedicated to digital art and experimental visual languages.', [('Project','Iterations/inversions',True)]),('September 2022','Selected for Neologia — New Languages of Visual Design in Italy, Turin','Exhibition dedicated to emerging trends in Italian visual design, exploring new languages, practices and perspectives in contemporary visual communication.', [('Editorial project','Draw a line from one side of the page to the other',True)])]
    for d,t,desc,details in awards: y=row(y,d,t,details,desc,gap=10)
    y=section(y,'Language skills')
    y=row(y,'','Certifications',[('ETS TOEIC Certificate','870/990',False)],gap=10)
    y=row(y,'','English language',[('Reading','Advanced',False),('Writing','Advanced',False),('Speaking','Advanced',False)],gap=10)
    y=row(y,'','French language',[('Reading','Basic',False),('Writing','Basic',False),('Speaking','Basic',False)],gap=10)
    y=row(y,'','Italian language',[('','Native speaker',False)],gap=16)
    consent='I authorise the processing of my personal data pursuant to GDPR 2016/679 of 27 April 2016 (European Regulation on the protection of natural persons with regard to the processing of personal data);\nI authorise publication of this Curriculum Vitae on the institutional website of Politecnico di Milano (Transparency Administration section) in compliance with Legislative Decree No. 33 of 14 March 2013 (as amended).'
    y=draw_lines(M,y,text_lines(consent,RIGHT-M,size=9.8),size=9.8,lead=12.5); y-=10
    c.setFont(FONT,8.5); c.drawString(M,y,'Milan, July 2026')
    c.showPage()

page1(); page2(); page3(); page4(); c.save()
