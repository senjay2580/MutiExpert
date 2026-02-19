"""文档解析服务 - 支持 PDF/Word/Markdown"""
import io


async def parse_document(file_content: bytes, file_type: str) -> str:
    """从文件内容提取纯文本"""
    if file_type == "pdf":
        return _parse_pdf(file_content)
    elif file_type == "docx":
        return _parse_docx(file_content)
    elif file_type == "md":
        return file_content.decode("utf-8", errors="ignore")
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def _parse_pdf(content: bytes) -> str:
    from PyPDF2 import PdfReader
    reader = PdfReader(io.BytesIO(content))
    texts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            texts.append(text)
    return "\n\n".join(texts)


def _parse_docx(content: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(content))
    texts = []
    for para in doc.paragraphs:
        if para.text.strip():
            texts.append(para.text)
    return "\n\n".join(texts)
