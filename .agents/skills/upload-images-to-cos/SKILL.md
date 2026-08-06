---
name: upload-images-to-cos
description: 上传本地图片到腾讯 COS，并返回可直接用于 Markdown 的公开链接。用于“上传图片到 cos”“把配图传到腾讯云并给我链接”“上传文章图片并插入 Markdown”等任务。默认读取 aritcles-hub 根目录 `.env` 中的 COS 凭据，优先上传到 `articles/` 前缀。
---

# Upload Images To COS

把本地图片上传到腾讯 COS，并返回公开 URL。

## 什么时候用

当用户要求：

- 上传图片到 COS
- 把文章配图传到腾讯云
- 返回可直接插入 Markdown 的图片链接
- 上传后顺手替换或插入到文章里

## 默认约定

- 默认 `.env` 路径：`/data/home/lukemxjia/aritcles-hub/.env`
- 默认 COS 前缀：`articles`
- 默认公开链接格式：`https://<bucket>.cos.<region>.myqcloud.com/<key>`
- 这个仓库的 `.env` 里字段名可能是 `secretKye`，这是历史拼写，脚本已兼容

## 工作流

1. 先确认要上传的本地图片路径。
2. 如果用户没指定远端 key，默认使用 `articles/<本地文件名>`。
3. 用 `scripts/upload_images_to_cos.sh` 执行上传。
4. 返回每张图的公开 URL。
5. 如果用户还要求“插入文章/替换链接”，把 URL 写回 Markdown。

## 执行规则

- 不要在对话里回显 `.env` 中的密钥。
- 优先使用脚本，不要每次临时手写 `coscli` 命令。
- 如果网络或沙箱阻止上传，直接申请提权并重试。
- 如果用户没有指定远端目录，博客文章图片默认放 `articles/`。
- 如果是多张图，逐张上传并逐张返回 URL，保持顺序。

## 脚本用法

```bash
bash .agents/skills/upload-images-to-cos/scripts/upload_images_to_cos.sh \
  --env /data/home/lukemxjia/aritcles-hub/.env \
  --prefix articles \
  /abs/path/a.png \
  /abs/path/b.png:custom-name.png
```

输出为制表符分隔的三列：

```text
<local_path>    <cos_key>    <public_url>
```

## 常见后续动作

- 插入 Markdown：`![alt](url)`
- 替换旧 COS 链接
- 给文章补头图、正文图、二维码图
