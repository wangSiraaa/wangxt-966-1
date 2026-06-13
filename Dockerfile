# 多阶段构建
# 阶段1: 构建前端
FROM node:18-alpine AS client-build

WORKDIR /app/client
COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# 阶段2: 构建后端
FROM node:18-alpine AS server-build

WORKDIR /app/server
COPY server/package*.json ./
RUN npm install

COPY server/ ./
RUN npm run build

# 阶段3: 运行时
FROM node:18-alpine

WORKDIR /app

# 复制后端构建产物
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/package*.json ./server/

# 安装后端生产依赖
WORKDIR /app/server
RUN npm install --production

# 复制前端构建产物到后端可访问的位置
WORKDIR /app
COPY --from=client-build /app/client/dist ./client/dist

# 数据目录
RUN mkdir -p /app/server/data

# 暴露端口
EXPOSE 3001

# 环境变量
ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/app/server/data

# 启动命令
WORKDIR /app/server
CMD ["node", "dist/index.js"]
