"""Append attribution outside the picture; never paint over existing watermarks."""
import io
from functools import lru_cache
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONT = Path(__file__).parent / 'fonts' / 'NotoSansCJKsc-Regular.otf'

@lru_cache(maxsize=8)
def font(size):
    return ImageFont.truetype(str(FONT), size)

def credit_image(raw, credit, source):
    image = Image.open(io.BytesIO(raw)).convert('RGB')
    width = max(640, image.width)
    size = max(16, min(24, width // 42))
    face = font(size)
    lines = []
    for text in (f'署名：{credit or "未公开署名"}', f'来源：{source}'):
        line = ''
        for char in text:
            if char in '\r\n\t': char = ' '
            if line and face.getlength(line + char) > width - 32:
                lines.append(line); line = ''
            line += char
        lines.append(line)
    step = size + 10
    result = Image.new('RGB', (width, image.height + step * len(lines) + 24), '#102d4d')
    result.paste(image, ((width - image.width) // 2, 0))
    draw = ImageDraw.Draw(result)
    for i, line in enumerate(lines):
        draw.text((16, image.height + 8 + i * step), line, font=face, fill='#ffffff')
    output = io.BytesIO()
    result.save(output, 'JPEG', quality=92)
    return output.getvalue()
