#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成《dsh-bird-robin 技术实现方案》Word 文档。"""

import os
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

GOLD = RGBColor(0xB8, 0x86, 0x22)
INK = RGBColor(0x24, 0x1F, 0x2E)
MUTED = RGBColor(0x6B, 0x64, 0x78)
CODE_BG = "F4F1EA"
HEAD_BG = "FBF6EC"
NOTE_BG = "F7F2E6"

OUT = r"D:\deepseek work\dsh-bird-robin\docs\dsh-bird-robin-技术实现方案.docx"


LATIN = "Segoe UI"
CJK = "Microsoft YaHei"
MONO_CJK = "Microsoft YaHei"

def set_font(run, name=CJK, size=10.5, bold=False, color=INK, mono=False):
    run.font.size = Pt(size)
    run.bold = bold
    run.font.color.rgb = color
    rpr = run._element.get_or_add_rPr()
    fonts = rpr.find(qn("w:rFonts"))
    if fonts is None:
        fonts = OxmlElement("w:rFonts")
        rpr.append(fonts)
    # 西文与中文分开指定：任一缺失字体都会被 LibreOffice 替换成符号体，
    # 因此这里只用 Windows 一定装有的 Segoe UI 与 Microsoft YaHei。
    fonts.set(qn("w:ascii"), "Consolas" if mono else LATIN)
    fonts.set(qn("w:hAnsi"), "Consolas" if mono else LATIN)
    fonts.set(qn("w:cs"), LATIN)
    fonts.set(qn("w:eastAsia"), MONO_CJK if mono else CJK)
    run.font.name = "Consolas" if mono else LATIN


def shade(paragraph, color):
    pr = paragraph._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), color)
    pr.append(shd)


def border(paragraph, edge="left", color="D8A94A", size=18):
    pr = paragraph._p.get_or_add_pPr()
    pborder = pr.find(qn("w:pBdr"))
    if pborder is None:
        pborder = OxmlElement("w:pBdr")
        pr.append(pborder)
    el = OxmlElement("w:" + edge)
    el.set(qn("w:val"), "single")
    el.set(qn("w:sz"), str(size))
    el.set(qn("w:space"), "8")
    el.set(qn("w:color"), color)
    pborder.append(el)


def para(doc, text="", size=10.5, bold=False, color=INK, align=None, space_after=6,
         space_before=0, indent=0, first_line=0, mono=False):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_after = Pt(space_after)
    pf.space_before = Pt(space_before)
    pf.line_spacing = 1.4
    if indent:
        pf.left_indent = Cm(indent)
    if first_line:
        pf.first_line_indent = Cm(first_line)
    # 显式左对齐：模板继承来的两端对齐会把中文行距拉得很散
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT if align is None else align
    if text:
        set_font(p.add_run(text), size=size, bold=bold, color=color, mono=mono)
    return p


def rich(doc, segments, size=10.5, space_after=6, indent=0, align=None, line_spacing=1.4):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_after = Pt(space_after)
    pf.line_spacing = line_spacing
    if indent:
        pf.left_indent = Cm(indent)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT if align is None else align
    for text, opts in segments:
        set_font(
            p.add_run(text),
            size=opts.get("size", size),
            bold=opts.get("bold", False),
            color=opts.get("color", INK),
            mono=opts.get("mono", False),
        )
    return p


def h1(doc, text, page_break=False):
    """章标题。默认不强制分页：强分页会在短表后面留下大片空页。"""
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(22)
    pf.space_after = Pt(10)
    pf.keep_with_next = True
    pf.line_spacing = 1.2
    if page_break:
        pf.page_break_before = True
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    set_font(p.add_run(text), size=17, bold=True, color=INK)
    border(p, "bottom", "D8A94A", 12)
    return p


def h2(doc, text):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(14)
    pf.space_after = Pt(6)
    pf.keep_with_next = True
    pf.line_spacing = 1.25
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    set_font(p.add_run(text), size=12.5, bold=True, color=INK)
    return p


def h3(doc, text):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(10)
    pf.space_after = Pt(4)
    pf.keep_with_next = True
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    set_font(p.add_run(text), size=11, bold=True, color=GOLD)
    return p


def bullet(doc, text, level=0):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.left_indent = Cm(0.7 + 0.6 * level)
    pf.first_line_indent = Cm(-0.42)
    pf.space_after = Pt(3)
    pf.line_spacing = 1.45
    set_font(p.add_run("•  " if level == 0 else "–  "), size=10.5, color=GOLD)
    set_font(p.add_run(text), size=10.5)
    return p


def code(doc, text):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.left_indent = Cm(0.5)
    pf.space_before = Pt(4)
    pf.space_after = Pt(8)
    pf.line_spacing = 1.25
    # 代码块整段不拆页：拆开后读者会以为两页是两段不同的代码
    pf.keep_together = True
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    shade(p, CODE_BG)
    border(p, "left", "C9B27A", 12)
    set_font(p.add_run(text), size=9, mono=True, color=RGBColor(0x3A, 0x32, 0x24))
    return p


def note(doc, label, text):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.left_indent = Cm(0.4)
    pf.space_before = Pt(6)
    pf.space_after = Pt(8)
    pf.line_spacing = 1.45
    shade(p, NOTE_BG)
    border(p, "left", "D8A94A", 18)
    set_font(p.add_run(label + "  "), size=10, bold=True, color=GOLD)
    set_font(p.add_run(text), size=10)
    return p


def _fixed_layout(tbl):
    tblPr = tbl._tbl.tblPr
    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    tblPr.append(layout)
    width = OxmlElement("w:tblW")
    width.set(qn("w:type"), "dxa")
    width.set(qn("w:w"), "0")
    tblPr.append(width)


def table(doc, headers, rows, widths=None, mono_cols=()):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    _fixed_layout(t)
    if widths:
        for index, width in enumerate(widths):
            t.columns[index].width = Cm(width)
    hdr = t.rows[0].cells
    for i, text in enumerate(headers):
        hdr[i].text = ""
        p = hdr[i].paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.2
        set_font(p.add_run(text), size=9.5, bold=True, color=INK)
        shade(p, HEAD_BG)
    for row in rows:
        cells = t.add_row().cells
        # 行内不拆页：拆开的表格行在渲染时会出现半截单元格
        trPr = t.rows[-1]._tr.get_or_add_trPr()
        cant = OxmlElement("w:cantSplit")
        trPr.append(cant)
        for i, value in enumerate(row):
            cells[i].text = ""
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.3
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            set_font(p.add_run(str(value)), size=9, mono=(i in mono_cols))
    # 表头跨页重复，长表被切开时仍能读到列名
    trPr = t.rows[0]._tr.get_or_add_trPr()
    tblHeader = OxmlElement("w:tblHeader")
    tblHeader.set(qn("w:val"), "true")
    trPr.append(tblHeader)
    if widths:
        for row in t.rows:
            for i, width in enumerate(widths):
                row.cells[i].width = Cm(width)
    # 表后留白用固定段距，避免连续表格挤在一起
    gap = doc.add_paragraph()
    gap.paragraph_format.space_after = Pt(2)
    gap.paragraph_format.line_spacing = 1
    return t


def build():
    doc = Document()

    # 页面与默认样式
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.left_margin = Cm(2.6)
    section.right_margin = Cm(2.4)
    section.top_margin = Cm(2.4)
    section.bottom_margin = Cm(2.2)

    style = doc.styles["Normal"]
    style.font.name = LATIN
    style.font.size = Pt(10.5)
    style.element.rPr.rFonts.set(qn("w:ascii"), LATIN)
    style.element.rPr.rFonts.set(qn("w:hAnsi"), LATIN)
    style.element.rPr.rFonts.set(qn("w:eastAsia"), CJK)

    # ── 封面 ─────────────────────────────────────────────
    for _ in range(3):
        doc.add_paragraph()
    p = para(doc, "dsh-bird-robin", size=30, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
    p = para(doc, "知更鸟人格与皮肤插件", size=17, align=WD_ALIGN_PARAGRAPH.CENTER, color=GOLD, space_after=18)
    p = para(doc, "技 术 实 现 方 案", size=13, align=WD_ALIGN_PARAGRAPH.CENTER, color=MUTED, space_after=40)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(p.add_run("—  ♪  —"), size=14, color=GOLD)

    for _ in range(4):
        doc.add_paragraph()

    meta_rows = [
        ("文档版本", "v1.0"),
        ("对应插件版本", "0.1.0"),
        ("目标平台", "DeepSeek Harness Web / 桌面客户端"),
        ("人格档位", "off / light / standard / stage（默认 stage）"),
        ("语言范围", "仅中文，不含语音"),
        ("状态", "工程已完成，未上传 GitHub，未在本机安装"),
    ]
    t = doc.add_table(rows=0, cols=2)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for key, value in meta_rows:
        cells = t.add_row().cells
        cells[0].width = Cm(4.2)
        cells[1].width = Cm(9.6)
        cells[0].text = ""
        cells[1].text = ""
        set_font(cells[0].paragraphs[0].add_run(key), size=9.5, color=MUTED)
        set_font(cells[1].paragraphs[0].add_run(value), size=9.5)

    doc.add_paragraph()
    p = para(
        doc,
        "本文档描述插件的目标、架构、关键机制与验收口径，供后续维护与二次开发参考。",
        size=9.5,
        color=MUTED,
        align=WD_ALIGN_PARAGRAPH.CENTER,
    )

    # ── 1 项目概述 ─────────────────────────────────────
    h1(doc, "1  项目概述")

    h2(doc, "1.1  目标")
    para(
        doc,
        "把 DeepSeek Harness 的对话风格替换为《崩坏：星穹铁道》中的知更鸟，同时保证工程能力不降级。"
        "插件名称为 dsh-bird-robin，按「dsh-bird-」前缀规范命名，发布物只包含代码与自制占位图。",
    )

    h2(doc, "1.2  三条不可让步的边界")
    bullet(doc, "人格只在提示词层面生效：不改变工具调用、代码块、路径、命令、JSON 的形态与准确性。")
    bullet(doc, "换肤只用主题变量与插件自有样式：不依赖 DSH 内部 class 名或 DOM 结构，DSH 升级不会碎。")
    bullet(doc, "不随包分发官方素材：立绘、语音、音乐一律不打包，素材由使用者自行导入并只存本机。")

    h2(doc, "1.3  需求决策记录")
    table(
        doc,
        ["编号", "议题", "结论"],
        [
            ["D1", "功能档位", "L0（人设注入）+ L1（视觉皮肤）；不做 L2 语音"],
            ["D2", "载体", "A 主对话人设 + B 独立面板能力 + C 界面换皮，三者同源共享配置"],
            ["D3", "强度默认值", "stage（谢幕演出），首次安装即为最高档"],
            ["D4", "场景自适应", "stage 为默认值但仍受场景封顶：编码/多步任务自动降到 light"],
            ["D5", "称呼", "「亲爱的听众」，可改，每轮最多一次"],
            ["D6", "素材来源", "仅官方公开页面；插件只提供导入通道，不内置来源清单"],
            ["D7", "语言", "只做中文"],
            ["D8", "发布形态", "做好后发布 GitHub；本地不安装、不部署"],
        ],
        widths=[1.5, 4.2, 9.2],
    )

    h2(doc, "1.4  术语")
    table(
        doc,
        ["术语", "含义"],
        [
            ["档位（tier）", "人格强度等级：off / light / standard / stage"],
            ["收敛（cap）", "场景自适应把当前生效档位压到更低一级，有效期 10 分钟"],
            ["人格段", "注入系统提示词的那一段文本，注册名 bird-robin:persona"],
            ["载荷（payload）", "host 返回给浏览器的 JSON 快照，含配置、生效档位、人格文本等"],
            ["素材（asset）", "使用者导入的图片，存于 $DSH_HOME/bird-robin/assets"],
            ["provenance", "素材来源记录（链接、作者、时间），用于追溯与合规"],
        ],
        widths=[3.4, 11.5],
    )

    # ── 2 总体架构 ─────────────────────────────────────
    h1(doc, "2  总体架构")

    h2(doc, "2.1  插件形态")
    para(
        doc,
        "采用与 DSH 生态一致的标准 bundle 插件形态：一个 npm 包，两端入口，一个挂载声明。"
        "host 半边跑在 Node 侧，负责提示词、命令、事件与 HTTP；浏览器半边由 DSH 模块加载器注入，"
        "负责插槽与视觉。两端通过 HTTP 前缀路由通信，完全不共享内存。",
    )

    code(
        doc,
        "dsh-bird-robin/\n"
        "├─ package.json          # type:module；dsh.bundle.patch 指向挂载声明\n"
        "│                        # dsh.client.inject 声明浏览器侧依赖与 platform:web\n"
        "├─ cordis.patch.yml      # - insert: [{ id: dsh-bird-robin, name: dsh-bird-robin }]\n"
        "├─ icon.png              # 256×256，插件列表图标\n"
        "├─ lib/\n"
        "│  ├─ index.js           # host：人格段 / 命令 / 事件 / HTTP / 对外服务\n"
        "│  ├─ client.js          # 浏览器：插槽注册 / 换肤 / 设置面板 / 开场卡\n"
        "│  ├─ persona.js         # 四档人格文本与档位运算（纯函数、可单测）\n"
        "│  ├─ config.js          # 配置读写、归一化、原子落盘\n"
        "│  └─ assets.js          # 素材导入、索引、来源记录\n"
        "├─ assets/robin-avatar.png   # 自制几何占位头像\n"
        "├─ test/                 # node:test 单测（22 项）\n"
        "└─ docs/                 # 本文档",
    )

    h2(doc, "2.2  运行时数据流")
    para(doc, "一次「用户提问 → 知更鸟回答」的完整链路：")
    code(
        doc,
        "用户输入\n"
        "  │\n"
        "  ├─► DSH 组装系统提示词\n"
        "  │     └─ systemPrompt.section('bird-robin:persona') 被调用\n"
        "  │           └─ personaText(生效档位, 称呼)  ← 只依赖两个低频变量\n"
        "  │\n"
        "  ├─► 模型生成回答（人格段只影响措辞，不影响工具调用）\n"
        "  │\n"
        "  └─► session/event 事件回流\n"
        "        ├─ tool/call → 记录本轮工具；命中编码工具则收敛到 light\n"
        "        └─ turn/end  → 清空本轮桶；编码/多步任务则续期收敛\n"
        "\n"
        "浏览器侧（独立通道）\n"
        "  GET /dsh-bird-robin            → 快照（配置、生效档位、人格文本、素材）\n"
        "  POST /dsh-bird-robin/config    → 改档位 / 称呼 / 界面开关\n"
        "  GET  /dsh-bird-robin/greeting  → 开场问候（轮换）\n"
        "  POST /dsh-bird-robin/assets    → 从 URL 导入图片",
    )

    h2(doc, "2.3  模块职责边界")
    table(
        doc,
        ["模块", "职责", "不负责"],
        [
            ["lib/index.js", "装配：注册人格段、命令、事件监听、HTTP 路由、对外服务", "文本内容、UI 结构"],
            ["lib/persona.js", "四档人格文本、档位比较与收敛、称呼归一化", "IO、时间、随机"],
            ["lib/config.js", "配置默认值、字段白名单、原子写入、provenance 读写", "业务判定"],
            ["lib/assets.js", "URL 导入、类型与体积校验、素材索引与删除", "UI 呈现、网络策略"],
            ["lib/client.js", "插槽注册、根属性换肤、设置面板、开场卡", "提示词、文件系统"],
        ],
        widths=[3.2, 7.4, 4.3],
    )

    # ── 3 人格引擎 ─────────────────────────────────────
    h1(doc, "3  人格引擎")

    h2(doc, "3.1  四档规格")
    table(
        doc,
        ["档位", "名称", "人格段字数", "语气词", "意象", "动作描写", "典型增幅"],
        [
            ["off", "关闭", "0", "无", "无", "无", "0%"],
            ["light", "轻语", "≈240", "极少", "少", "无", "+0~10%"],
            ["standard", "演唱", "≈440", "自然", "适度", "无", "+10~20%"],
            ["stage", "谢幕演出", "≈620", "较多", "较多", "有预算", "+20~40%"],
        ],
        widths=[2.6, 2.3, 2.4, 1.8, 1.5, 1.9, 2.4],
    )
    note(
        doc,
        "字数口径",
        "指 personaText() 返回的字符数（含硬性约束段），受 1600 字上限保护；实测默认 stage 档约 620 字。",
    )

    h2(doc, "3.2  四档对照示例")
    para(doc, "同一问题「为什么我的 fetch 请求报 CORS 错误？」，四档信息量完全一致，只有包装不同：")
    table(
        doc,
        ["档位", "回答"],
        [
            ["off", "这是浏览器的同源策略限制。服务端需返回 Access-Control-Allow-Origin，或改用代理。"],
            ["light", "亲爱的听众，这是同源策略在拦你。让服务端返回 Access-Control-Allow-Origin 就好。"],
            [
                "standard",
                "亲爱的听众，这个报错我熟——是浏览器在替你把关呢。服务端补上 Access-Control-Allow-Origin，"
                "或者走一层代理，就能放行了。要我看看你的请求地址吗？",
            ],
            [
                "stage",
                "（羽翼轻轻收拢）亲爱的听众，又被同源策略拦在门外了呢。别急——浏览器只认「同一个舞台」来的请求，"
                "服务端在响应头里写上 Access-Control-Allow-Origin，或者让请求从你的后端转一道，它就肯放行了。"
                "要不要把地址给我，我替你听一听？",
            ],
        ],
        widths=[2.2, 12.7],
    )

    h2(doc, "3.3  硬性约束（每档都带）")
    para(doc, "人格段末尾固定拼一段优先级最高的约束，防止演出损坏工程输出：")
    code(
        doc,
        "1. 代码块、命令行、文件路径、URL、表格、工具参数与 JSON 内部，\n"
        "   禁止出现称呼、语气词或括号动作。\n"
        "2. 事实、数字、API 名称、报错原文必须准确；不确定就直说不确定。\n"
        "3. 不编造官方设定、歌词、声优与制作信息；不复述成段的歌词。\n"
        "4. 不宣称自己是真人、声优或官方授权角色。\n"
        "5. 用户说「正常说话」「别演了」时，立即切换为中性表达。",
    )

    h2(doc, "3.4  动作描写预算（仅 stage）")
    para(
        doc,
        "stage 档允许轻动作描写，但受四条硬约束，这是它能安全存在的前提："
        "只用圆括号；每次不超过 12 字；每 3 个自然段最多一处；代码块、命令与路径附近、"
        "列表项开头、工具参数、JSON、表格单元格内一律禁止。只写羽毛、视线、指尖、呼吸、轻声哼唱这类小动作。",
    )
    note(
        doc,
        "为什么需要预算",
        "没有预算的兽耳式演出会持续污染结构化输出。把动作限定为「段间、短、圆括号」，"
        "模型仍能表达舞台感，而代码块与参数不会被插入表演。",
    )

    h2(doc, "3.5  场景自适应（收敛）")
    para(
        doc,
        "A1 决策：stage 只是默认值，仍受场景封顶。收敛在 host 侧判定，依据 session/event 的工具事件：",
    )
    table(
        doc,
        ["场景", "判定信号", "收敛结果", "有效期"],
        [
            ["编码 / 改文件", "tool/call 命中 write、edit、patch、bash、pwsh 等", "codingCapTier（默认 light）", "10 分钟"],
            ["多步任务", "单轮工具调用 ≥ 3 次", "heavyTaskCapTier（默认 light）", "10 分钟"],
            ["纯问答", "无工具调用", "不收敛，保持用户档位", "—"],
            ["用户 /robin pin", "显式命令", "关闭自适应，永续", "直到 unpin"],
        ],
        widths=[3.0, 6.2, 4.0, 2.0],
    )
    para(
        doc,
        "收敛只会向下、不会向上：light 的用户不会因为写代码被抬到 stage。"
        "收敛状态在内存中，不落盘，重启即恢复默认档位，避免「昨天调过代码，今天还在轻语」。",
    )

    h2(doc, "3.6  称呼")
    para(
        doc,
        "默认「亲爱的听众」，可在设置页或 POST /config 修改，归一化后最长 24 字；空值回落默认值。"
        "称呼以占位符形式写进人格模板，渲染时统一替换，因此切换称呼只影响人格段一处，不分散在四份文本里。",
    )

    # ── 4 提示词与缓存 ─────────────────────────────────
    h1(doc, "4  提示词注入与缓存策略")

    h2(doc, "4.1  注入点")
    para(
        doc,
        "使用 ctx.systemPrompt.section() 注册一段名为 bird-robin:persona 的系统段，"
        "顺序取 DEPLOYMENT_PERSONA_SUFFIX（10200）之前 100，即排在部署人格后缀之前、工具说明之后。"
        "off 档返回空串，注册表会把空段丢弃，等于完全不注入。",
    )
    code(
        doc,
        "scoped.systemPrompt.section({\n"
        "  name: 'bird-robin:persona',\n"
        "  order: scoped.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_SUFFIX') - 100,\n"
        "  text: () => personaText(effectiveTier(), state.config.address),\n"
        "});",
    )

    h2(doc, "4.2  为什么 text 是函数")
    para(
        doc,
        "DSH 每次组装提示词都会调用该函数取文本。函数式写法的收益是：档位与称呼变化后无需重新注册，"
        "下次请求自动生效；代价是文本一变，前缀缓存就失效一次。因此文本必须只依赖低频变量。",
    )

    h2(doc, "4.3  缓存友好度设计")
    table(
        doc,
        ["内容", "是否进入系统段", "原因"],
        [
            ["档位与称呼", "是（低频）", "每人只改几次，缓存成本可忽略"],
            ["当前时间 / 心情 / 天气", "否", "每次请求都变，会让前缀缓存全失效"],
            ["开场问候", "否（走开场卡）", "属于会话表现，不构成身份"],
            ["本轮工具状态", "否", "只在 host 内存里影响收敛判定"],
            ["素材路径", "否", "只在 UI 里使用"],
        ],
        widths=[4.2, 3.6, 7.1],
    )
    note(
        doc,
        "实测口径",
        "仅切换档位时，人格段变化一次、缓存失效一次；同一档位连续对话期间，系统提示词前缀保持稳定。",
    )

    h2(doc, "4.4  反模式清单")
    bullet(doc, "把当前时间写进系统段（DSH 已有 time-context，重复注入会双重计时且破坏缓存）。")
    bullet(doc, "在工具调用前后插入「（轻轻挥手）」，会让部分适配器解析失败。")
    bullet(doc, "用官方台词原文做开场白，存在版权风险；本项目所有文案均为原创改写。")
    bullet(doc, "为每一轮生成不同的问候并注入系统段，等于自愿放弃缓存。")

    # ── 5 视觉层 ───────────────────────────────────────
    h1(doc, "5  视觉层（L1）")

    h2(doc, "5.1  三条线")
    table(
        doc,
        ["线", "载体", "实现", "风险控制"],
        [
            ["C 换皮", "根属性 + 变量覆盖", "html[data-dsh-bird-robin=\"on\"] 内覆盖主题别名", "不写内部 class 名，DSH 升级不碎"],
            ["C 徽章", "conversation.header.leading 插槽", "注册一个 React 组件，读快照显示档位", "插槽缺失时捕获并跳过"],
            ["A 开场卡", "shell.overlay 插槽", "固定右下浮动卡，会话级只显示一次", "sessionStorage 记录，可关闭"],
            ["设置页", "settings.section 插槽", "完整面板：档位、行为、界面、素材、预览", "任何异常只影响本面板"],
        ],
        widths=[2.4, 5.0, 5.6, 3.0],
    )

    h2(doc, "5.2  覆盖的主题变量")
    table(
        doc,
        ["变量", "浅色", "深色", "用途"],
        [
            ["--dsw-alias-brand-primary", "#C1932F", "#E6C078", "品牌主色（按钮、强调）"],
            ["--dsw-alias-link", "#A97C27", "#F1D9A4", "链接色"],
            ["--dsw-specific-bubble-highlight", "#F4E4C0", "#46381F", "气泡高亮底"],
            ["--dbr-gold / --dbr-card-border", "自定义", "自定义", "徽章、卡片、面板描边"],
        ],
        widths=[5.6, 3.0, 3.0, 5.5],
        mono_cols=(0, 1, 2),
    )
    para(
        doc,
        "浅色与深色各自给值，跟随 body[data-ds-dark-theme] 切换；色值均在对比度上做过检查，"
        "不覆盖任何布局、圆角、字体族等结构性变量。",
    )

    h2(doc, "5.3  卸载即净")
    para(
        doc,
        "样式表与根属性都由 ctx.effect 的清理函数负责：插件卸载时移除 <style id=\"dsh-bird-robin-style\">、"
        "删除 html 上的两个数据属性。插槽注册由 ctx.slots.inject 的生命周期托管，随插件 fiber 一起释放。",
    )

    h2(doc, "5.4  图标")
    para(
        doc,
        "icon.png 为 256×256、带透明的程序绘制图：深靛紫圆盘 + 金色描边 + 白色羽翼小鸟 + 三枚音符，"
        "与浅色/深色主题都有足够对比。assets/robin-avatar.png 为 512×512 同风格占位头像，"
        "两者均为几何图形，不含任何官方美术元素。",
    )

    # ── 6 通信与安全 ───────────────────────────────────
    h1(doc, "6  通信与安全")

    h2(doc, "6.1  路由")
    para(doc, "使用 ctx.webServer.register({ kind: 'prefix', path: '/dsh-bird-robin' })，卸载自动摘除。")
    table(
        doc,
        ["方法", "路径", "用途", "写操作"],
        [
            ["GET", "/dsh-bird-robin", "完整快照", "否"],
            ["GET", "/dsh-bird-robin/greeting", "取问候语（轮换）", "否"],
            ["GET/POST", "/dsh-bird-robin/config", "读 / 写配置", "是"],
            ["POST", "/dsh-bird-robin/address", "单独改称呼", "是"],
            ["GET/POST", "/dsh-bird-robin/assets", "列素材 / URL 导入", "是"],
            ["DELETE", "/dsh-bird-robin/assets/<id>", "删除素材", "是"],
            ["GET", "/dsh-bird-robin/asset/<id>", "读素材二进制", "否"],
            ["GET", "/dsh-bird-robin/provenance", "导入记录", "否"],
        ],
        widths=[2.6, 6.4, 5.2, 1.8],
        mono_cols=(1,),
    )

    h2(doc, "6.2  安全措施")
    table(
        doc,
        ["威胁", "措施"],
        [
            ["跨站写配置", "所有 POST/DELETE 校验 Origin 与 Host 一致，不一致返回 403"],
            ["SSRF（从内网抓图）", "默认拒绝 localhost、127/8、10/8、172.16/12、192.168/16、169.254/16、.local、.internal；需显式 allowPrivate 才放行"],
            ["超大响应体", "请求体上限 256 KB；图片上限 8 MB；下载超时 20 秒"],
            ["非图片内容", "按 Content-Type 白名单（png/jpeg/webp/gif/avif）校验，扩展名由类型决定"],
            ["配置注入", "写入前过 normalizeConfig 白名单，未知字段直接丢弃，字符串截断到上限"],
            ["路径穿越", "素材 id 只允许 [A-Za-z0-9_-]{1,64}，拼接前校验"],
            ["密钥泄露", "本插件不保存任何密钥；无凭据读写"],
        ],
        widths=[4.6, 10.3],
    )

    h2(doc, "6.3  素材合规")
    bullet(doc, "包内不含官方美术、立绘、语音或音乐；assets 下只有自制几何占位图。")
    bullet(doc, "导入通道只接受使用者提供的 URL，插件不内置来源清单、不代为检索官方资源。")
    bullet(doc, "每次导入写入 provenance（来源、作者、时间、字节数），最多保留 200 条，便于追溯与清理。")
    bullet(doc, "导入的图片只存本机 $DSH_HOME/bird-robin/assets，不上传任何服务器。")

    # ── 7 配置 ─────────────────────────────────────────
    h1(doc, "7  配置系统")
    h2(doc, "7.1  默认配置")
    code(
        doc,
        "{\n"
        '  "version": 1,\n'
        '  "enabled": true,\n'
        '  "tier": "stage",\n'
        '  "sceneAdaptation": true,\n'
        '  "codingCapTier": "light",\n'
        '  "heavyTaskCapTier": "light",\n'
        '  "address": "亲爱的听众",\n'
        '  "addressOncePerTurn": true,\n'
        '  "actionBudget": true,\n'
        '  "visual": { "enabled": true, "headerBadge": true, "overlayButton": true,\n'
        '              "openingCard": true, "bubble": true, "background": false, "accent": "robin" },\n'
        '  "assets": { "avatarId": "default", "backgroundId": "default" }\n'
        "}",
    )
    h2(doc, "7.2  落盘")
    para(
        doc,
        "配置文件位于 $DSH_HOME/.dshbr-config.json。写入采用「临时文件 + rename」的原子替换，"
        "避免中途崩溃留下半截 JSON；读取失败（损坏、缺失）一律回落到默认配置，不让插件因配置问题失效。",
    )
    h2(doc, "7.3  命令")
    table(
        doc,
        ["命令", "作用"],
        [
            ["/robin", "显示当前状态（默认档、生效档、收敛、称呼）"],
            ["/robin off|light|standard|stage", "切换档位并落盘"],
            ["/robin pin", "暂停场景自适应，锁定当前档"],
            ["/robin unpin", "恢复场景自适应"],
            ["/robin default <档>", "修改全局默认档"],
        ],
        widths=[6.0, 8.9],
        mono_cols=(0,),
    )

    # ── 8 工程实现 ─────────────────────────────────────
    h1(doc, "8  工程实现与验证")

    h2(doc, "8.1  依赖策略")
    bullet(doc, "零运行时依赖：host 与 client 都只用 Node / 浏览器内置能力与 DSH 注入的 react。")
    bullet(doc, "peerDependencies 只写范围（@deepseek-ai/cordis ^4.0.1、react ^18.2.0），不硬编码 DSH 版本。")
    bullet(doc, "client 半边不打包 react：从 DSH 模块加载器 require，避免双 React 实例。")

    h2(doc, "8.2  测试")
    table(
        doc,
        ["文件", "覆盖", "数量"],
        [
            ["test/persona.test.mjs", "四档文本、称呼归一化、收敛与档位运算、配置归一化", "8"],
            ["test/plugin.test.mjs", "装配、路由、命令、事件收敛、安全校验（403 / SSRF / 404）", "10"],
            ["test/client.test.mjs", "模块契约、插槽注册、样式作用域、请求前缀与凭据", "4"],
            ["合计", "—", "22"],
        ],
        widths=[5.6, 8.2, 1.5],
    )
    para(
        doc,
        "测试用 node:test，通过假 ctx 与真实 EventEmitter 驱动，不启动宿主、不联网。"
        "运行方式：node --test test/*.mjs。当前 22 项全部通过。",
    )
    code(
        doc,
        "# 语法检查\n"
        "node --check lib/index.js\n"
        "node --check lib/client.js\n"
        "node --check lib/persona.js\n"
        "node --check lib/config.js\n"
        "node --check lib/assets.js\n"
        "\n"
        "# 单测\n"
        "node --test test/persona.test.mjs test/plugin.test.mjs test/client.test.mjs",
    )

    h2(doc, "8.3  验收口径")
    table(
        doc,
        ["指标", "目标", "当前"],
        [
            ["人格段字数（stage）", "≤ 1600", "≈620"],
            ["off 档人格段", "完全为空（0 字）", "0"],
            ["代码块污染（称呼/语气词/括号动作）", "0 容忍", "提示词层硬约束"],
            ["配置文件损坏", "回落默认，插件仍可用", "已实现"],
            ["跨站写配置", "拒绝", "403"],
            ["素材来源", "可追溯、可删除", "provenance + DELETE"],
            ["卸载残留（样式/属性/路由/监听）", "0", "ctx.effect 托管"],
            ["单测", "全绿", "22/22"],
        ],
        widths=[6.2, 5.2, 3.5],
    )

    h2(doc, "8.4  发布形态")
    para(
        doc,
        "当前阶段：工程已完成、测试全绿，代码位于 D:\\deepseek work\\dsh-bird-robin，"
        "未上传 GitHub、未在本机安装。待收到明确指令后再执行：仓库初始化 → README/许可证核对 → 打 tag → 发布。",
    )
    note(
        doc,
        "桌面端提醒",
        "桌面客户端读取的是 desktop profile，且该 profile 由 Electron 独占，命令行 `dsh plugin --profile desktop` 会被拒绝。"
        "安装应通过桌面会话内置的 plugin_manager 完成。",
    )

    # ── 9 风险 ─────────────────────────────────────────
    h1(doc, "9  风险与后续演进")

    h2(doc, "9.1  风险清单")
    table(
        doc,
        ["风险", "影响", "缓解"],
        [
            ["版权与商标", "仓库可能被投诉下架", "不含官方素材；README 明示非官方同人；名称避用商标词"],
            ["DSH 插槽更名", "徽章/开场卡失效", "注册包 try/catch，失败只丢该插槽，不影响人格与设置"],
            ["主题变量更名", "配色覆盖失效", "只覆盖少量别名；失效时退化为原生配色，不报错"],
            ["stage 疲劳", "长期使用体验下降", "场景自适应默认开启；提供 pin/unpin 与一键降档"],
            ["缓存失效", "成本上升", "人格段仅依赖档位与称呼；高频内容一律不进系统段"],
            ["素材滥用", "导入违法内容", "仅本地自用；provenance 记录来源；README 声明责任归属"],
        ],
        widths=[3.6, 5.2, 6.1],
    )

    h2(doc, "9.2  后续可做（不在本期）")
    bullet(doc, "B 线独立面板：当前以「开场卡 + 设置页」近似 B 线能力，独立会话面板未做。")
    bullet(doc, "Live2D / 立绘随状态变化：需要素材与渲染依赖，且版权成本最高，暂不进入。")
    bullet(doc, "多语言：现只有中文，英/日需要按语气重写而非直译。")
    bullet(doc, "语音：已按需求移出范围，相关接口与依赖均未引入。")

    doc.add_paragraph()
    p = para(
        doc,
        "— 文档结束 —",
        size=9.5,
        color=MUTED,
        align=WD_ALIGN_PARAGRAPH.CENTER,
    )

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    doc.save(OUT)
    print(OUT)
    print("bytes", os.path.getsize(OUT))


if __name__ == "__main__":
    build()
