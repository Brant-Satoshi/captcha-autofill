# 高级设置：适配新网站

脚本靠 CSS 选择器找到验证码图片和对应的输入框。内置的选择器覆盖了常见写法；某个网站没有出现识别图标，或者结果填错了位置时，可以自己补充选择器。

需要了解基本的 HTML 和 CSS 选择器。选择器写得太宽会在别的网站上误判，所以尽量写具体。

## 找到选择器

在目标网页按 F12 打开开发者工具，用元素选取工具点一下验证码图片，看它的标签和属性。

验证码图片必须是 `<img>` 或 `<canvas>` 元素。例如看到：

```html
<div class="login-code"><img class="code-img" src="/api/code?t=123" alt="code"></div>
<input name="verifyCode" placeholder="验证码">
```

可以这样写：

```css
/* 太宽，会匹配到其他图片，不要这样写 */
img

/* 推荐：带上容器和特征属性 */
.login-code img.code-img
img[src*="/api/code"]
```

输入框同理：

```css
input[name="verifyCode"]
```

属性选择器的常用写法：`[attr="值"]` 完全相等，`[attr*="值"]` 包含，`[attr^="值"]` 以它开头。

## 方式一：在设置面板里添加

打开设置面板的「高级设置」，在「自定义验证码图片选择器」和「自定义输入框选择器」里添加。这里添加的选择器对所有网站生效，适合临时适配。

## 方式二：写成站点规则

规则可以限定只在某个网站生效，更不容易误判。规则文件是一个 JSON 数组：

```json
[
  {
    "url_pattern": "example.com",
    "captcha_image_selector": ".login-code img.code-img",
    "captcha_input_selector": "input[name='verifyCode']"
  }
]
```

| 字段 | 说明 |
|---|---|
| `url_pattern` | 规则在哪些网址上生效，写法见下表 |
| `captcha_image_selector` | 验证码图片的选择器，必填 |
| `captcha_input_selector` | 输入框的选择器，留空则使用内置的输入框选择器 |

`url_pattern` 的写法：

| 写法 | 含义 |
|---|---|
| `example.com` | 网址中包含这段文字 |
| `*.example.org` | 通配符，`*` 代表任意字符，对域名或完整网址做整体匹配 |
| `/^https:\/\/secure\.example\.com\//` | 以 `/` 开头和结尾的是正则表达式，对完整网址匹配 |
| `*` 或留空 | 所有网站 |

规则有两个来源：

- **内置规则**：仓库根目录的 `rules.json`，构建时打包进脚本。修改后需要重新构建并安装。
- **远程规则**：在「高级设置」里填一个 `rules.json` 的地址，点「从远程加载规则」。加载成功后会缓存下来并取代内置规则；在「功能设置」里可以开启每天自动更新。

把自己的 `rules.json` 放在 GitHub 仓库里，远程地址填它的 raw 链接，就可以不重新安装脚本而更新规则。

## 输入框是怎么找的

脚本按下面的顺序找输入框，找到即停：

1. 验证码图片的父元素里，匹配输入框选择器的元素
2. 验证码所在的表单里
3. 整个页面里
4. 名称、id 或占位符中带有 captcha、verif、验证码 字样的输入框
5. 离验证码最近的文本输入框

如果结果填错了位置，给这个网站加一条带 `captcha_input_selector` 的规则即可。
