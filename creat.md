# 音乐网站v1.0开发计划  
## 一.项目概述   
### 1.1 开发目的    
- 掌握完整的springboot项目开发流程，接口设计，前后端交互    
- 做一个功能完备的能够展示在简历上的后端项目    
- 在开发中不断学习完善提升自己，将做学内容运用到实战中  
### 1.2 迭代计划    
     网站v1.0版本目标是做出一个最轻量的音乐播放器，做“开发者”与“用户”的互动 
### 1.3 技术栈
| 技术类别       | 选型                  | 选型理由                          |
|----------------|-----------------------|-----------------------------------|
| 核心框架       | Spring Boot 2.7.x     | 企业主流、配置简化、快速开发接口  |
| 数据库         | MySQL 8.0             | 关系型数据库，适合存储音乐结构化数据 |
| 数据库访问     | MyBatis-Plus          | 简化CRUD操作，无需手写基础SQL     |
| 接口调试       | Postman               | 测试接口可用性，验证返回结果      |
| 文档工具       | Markdown + VS Code    | 轻量易上手，可导出PDF用于简历展示 |  
---
## 二.需求分析 
### 2.1 功能需求（v1.0 最小可用集
| 角色   | 功能点                 | 详细描述                                   |
|--------|------------------------|--------------------------------------------|
| 管理员 | 音乐上传               | 上传mp3格式音乐，录入歌曲名、歌手、标签信息 |
| 游客   | 获取音乐列表           | 查看所有已上传的音乐基础信息（ID、歌名、歌手） |
| 游客   | 播放音乐               | 根据音乐ID播放对应的音乐文件               |
| 游客   | 切歌                   | 支持“上一首/下一首/随机切歌”               |     
### 2.2 非功能需求
- 接口返回格式统一：所有接口返回 {code: 状态码, msg: 提示信息, data: 业务数据}；
- 异常处理：上传非mp3文件、播放不存在的音乐ID时，返回明确的错误提示；
- 音乐存储：v1.0 暂存本地服务器指定目录 
## 三. 系统设计
### 3.1 架构设计（前后端分离）
```mermaid     
flowchart LR
    A[前端页面（AI生成）] --> B[后端Controller层（接口定义）]
    B --> C[Service层（业务逻辑）]
    C --> D[Mapper层（数据库操作）]
    C --> E[本地文件系统（音乐存储）]
    D --> F[MySQL数据库（音乐信息）]    
```  
### 3.2 数据库设计  
#### 3.2.1 音乐表

| 字段名     | 类型               | 约束                  | 描述              |
|------------|--------------------|-----------------------|-------------------|
| id         | BIGINT UNSIGNED    | PK AUTO_INCREMENT     | 主键              |
| title      | VARCHAR(200)       | NOT NULL              | 音乐名            |
| artist     | VARCHAR(100)       | NOT NULL              | 歌手名            |
| tags       | VARCHAR(255)       | NULL                  | 标签（逗号分隔）  |
| file_path  | VARCHAR(500)       | NOT NULL              | 存储路径（相对/绝对） |
| upload_time| DATETIME           | NOT NULL DEFAULT CURRENT_TIMESTAMP | 上传时间 |

简要说明：
- 设计简洁，满足 v1.0 需要。
- tags 用逗号分隔即可，后续可拆表优化。
- 建议索引：idx_title(title), idx_artist(artist), idx_upload_time(upload_time)（按需添加）。

示例 SQL：
```sql
CREATE TABLE music (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  artist VARCHAR(100) NOT NULL,
  tags VARCHAR(255),
  file_path VARCHAR(500) NOT NULL,
  upload_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_title (title),
  INDEX idx_artist (artist),
  INDEX idx_upload_time (upload_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
### 3.3 接口设计（核心）

| 接口路径 | 请求方式 | 接口功能 | 请求参数 | 返回格式（示例） | 备注 |
|---|:---:|---|---|---|---|
| /api/music/upload | POST | 上传音乐 | FormData：songName、singer、tags、file（mp3 文件） | {"code":200,"msg":"上传成功","data":{"id":1}} | 仅管理员可用（v1.0 暂不做权限校验） |
| /api/music/list | GET | 获取列表 | 无 | {"code":200,"msg":"查询成功","data":[{"id":1,"songName":"七里香","singer":"周杰伦"}]} | — |
| /api/music/play/{id} | GET | 播放音乐 | 路径参数：id（音乐 ID） | 音乐文件流（响应头：Content-Type: audio/mpeg） | 返回二进制文件流 |
| /api/music/switch | GET | 切歌 | Query：currentId（当前音乐 ID）、type（prev/next/random） | {"code":200,"msg":"切歌成功","data":{"id":2,"songName":"晴天"}} | — |
## 四. 开发步骤（边开发边记录）

### 4.1 环境搭建（已完成 / 待完成）
- [x] 安装 JDK 、Maven 、MySQL 
- [x] 用 Spring Initializr 创建 Spring Boot 项目，引入依赖（Web、MyBatis-Plus、MySQL Driver）
- [x] 配置 application.yml（数据库连接、文件上传路径、端口）

### 4.2 核心代码开发（待完成）
- [x] 实体类：Music.java（对应 music 表）
- [ ] Mapper 层：MusicMapper.java（继承 BaseMapper）
- [ ] Service 层：MusicService.java + MusicServiceImpl.java（实现上传 / 列表 / 播放 / 切歌逻辑）
- [ ] Controller 层：MusicController.java（定义接口）

