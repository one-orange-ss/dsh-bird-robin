# dsh-bird-robin

把 DeepSeek Harness 的对话人格换成《崩坏：星穹铁道》的知更鸟：**四档语气（默认「谢幕演出」）+ 界面换肤 + 开场卡 + 状态徽章**。

- 人格只在提示词层面生效，**工具调用、代码块、路径、JSON 一律不受影响**。
- 换肤只覆盖主题变量与插件自有样式，**不碰组件内部 DOM 与 class 名**。


## 功能

| 模块 | 内容 |
|---|---|
| 人格档位 | `off` / `light` 轻语 / `standard` 演唱 / `stage` 谢幕演出（默认） |
| 场景自适应 | 写文件、改代码、跑命令时自动收敛到 `light`；多步任务（≥3 次工具调用）同样收敛；10 分钟后自动恢复 |
| 称呼 | 默认「亲爱的听众」，可改，最长 24 字，每轮最多出现一次 |
| 动作描写预算 | 仅 stage 档启用：圆括号、≤12 字、每 3 段最多一处；代码与参数内禁止 |
| 界面 | 标题栏档位徽章（点击循环切换）、开场问候卡、金/天蓝配色、可选背景氛围 |
| 设置页 | 档位、行为开关、称呼、界面开关、素材导入、人格段实时预览与字数 |
| 命令 | `/robin status｜off｜light｜standard｜stage｜pin｜unpin｜default <档>` |
| 素材 | 从 URL 导入图片到 `$DSH_HOME/bird-robin/assets`，记录来源与作者，可删除 |

## 安装

```bash
# 作为 bundle 插件（推荐）
dsh plugin add <本目录或 tgz>

# 桌面客户端：桌面端 profile 由 Electron 独占，请在桌面会话里让内置
# plugin_manager 安装本包，不要用 `--profile desktop` 命令行。
```

开发期可用注入器闭环（免重启）：

```
dev_scaffold_plugin → dev_build_plugin → dev_inject_plugin
→ dev_reload_package → dev_uninject_plugin
```

## 目录

```
dsh-bird-robin/
├─ package.json          # bundle 声明 + client 半边声明
├─ cordis.patch.yml      # 挂载声明（一条 insert）
├─ icon.png              # 插件列表图标 256×256
├─ lib/
│  ├─ index.js           # host：人格段 / 命令 / 事件 / HTTP / 服务
│  ├─ client.js          # 浏览器：插槽注册 / 换肤 / 设置面板
│  ├─ persona.js         # 四档人格文本与档位运算（纯函数）
│  ├─ config.js          # 配置读写与归一化
│  └─ assets.js          # 素材导入、索引与来源记录
├─ assets/robin-avatar.png  # 自制占位头像（几何图形，非官方美术）
├─ test/                 # node:test 单测（18 项）
└─ docs/                 # 技术实现方案
```

## 运行时数据

| 路径 | 用途 |
|---|---|
| `$DSH_HOME/.dshbr-config.json` | 插件配置（档位、称呼、界面开关） |
| `$DSH_HOME/bird-robin/assets/` | 用户导入的图片 |
| `$DSH_HOME/bird-robin/provenance.json` | 导入记录（来源链接、作者、时间） |

`$DSH_HOME` 默认 `~/.dsh`，可用环境变量覆盖。

## HTTP 接口

全部挂在 `/dsh-bird-robin` 前缀下，由 `ctx.webServer.register({ kind: 'prefix' })` 注册，随插件卸载自动摘除。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/dsh-bird-robin` | 完整快照：配置、生效档位、人格文本、素材、路径 |
| GET | `/dsh-bird-robin/greeting` | 取一条问候语（轮换） |
| GET/POST | `/dsh-bird-robin/config` | 读 / 写配置（POST 经同源校验 + 白名单归一化） |
| GET/POST | `/dsh-bird-robin/assets` | 列素材 / 从 URL 导入 |
| DELETE | `/dsh-bird-robin/assets/<id>` | 删除素材 |
| GET | `/dsh-bird-robin/asset/<id>` | 读素材图片 |
| GET | `/dsh-bird-robin/provenance` | 导入记录 |

写接口要求同源（`Origin` 与 `Host` 一致），导入默认拒绝本机与内网地址。

## 设计要点

**为什么人格段是「函数」而不是每次重算字符串。**
`ctx.systemPrompt.section({ text })` 的文本只要变化，整条提示词前缀缓存就失效。这里 `text` 是函数，但输出只依赖两个低频变量：**档位**与**称呼**。它们每人只改几次，所以缓存成本约为零；时间、心情、问候等高频内容一律不进系统段（问候走开场卡）。

**为什么场景收敛放在 host。**
收敛判定读 `session/event` 的 `tool/call` 与 `turn/end`，不依赖客户端在线；且收敛只降低档位，不会在代码输出里插入表演。

**为什么换肤只用变量。**
`html[data-dsh-bird-robin="on"]` 作用域内覆盖 `--dsw-alias-brand-primary`、`--dsw-alias-link`、`--dsw-specific-bubble-highlight` 等主题别名，深浅两套各自给值。DSH 升级改组件结构时，本插件不会碎。

## 法律与免责

本项目是**非官方同人作品**，与米哈游 / HoYoverse 无关，未获授权。

