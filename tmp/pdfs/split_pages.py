from pypdf import PdfReader, PdfWriter
import os

source = PdfReader('output/pdf/CV_Isidori_EN.pdf')
os.makedirs('/private/tmp/cv_pages', exist_ok=True)
for index, page in enumerate(source.pages, 1):
    writer = PdfWriter()
    writer.add_page(page)
    with open(f'/private/tmp/cv_pages/page-{index}.pdf', 'wb') as handle:
        writer.write(handle)
