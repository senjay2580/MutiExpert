# 前端性能优化与规范检测

对前端项目进行全面的性能优化分析和规范检测，输出详细的优化方案和落地清单。

## 参数
- `$ARGUMENTS` - 检测范围，可选值：
  - `all` 或 `全面检测` - 执行完整的性能优化检测（默认）
  - `api` 或 `接口` - 仅检测接口调用规范
  - `cache` 或 `缓存` - 仅检测缓存策略
  - `render` 或 `渲染` - 仅检测渲染性能
  - `bundle` 或 `打包` - 仅检测打包体积优化
  - `network` 或 `网络` - 仅检测网络传输优化
  - 空参数 - 询问用户选择检测范围

## 执行原则

### 核心理念
> **代码即规范，实践即标准** —— 优先从项目代码中提取实际模式，对照行业最佳实践，输出可落地的优化方案

### 检测方法论
1. **静态分析优先**：通过代码扫描发现问题，避免主观臆断
2. **对比标准输出**：每个问题必须对照具体标准（如 Web Vitals、HTTP 缓存规范）
3. **分级输出方案**：区分「必须修复」「建议优化」「可选增强」
4. **落地路径明确**：每个优化点给出具体代码示例和实施步骤

## 执行步骤

### 1. 确认检测范围
根据参数确定检测模块：
- 全面检测：执行所有 7 大类检测
- 单项检测：仅执行指定模块

如果参数不明确，询问用户选择。

### 2. 项目环境分析
```bash
# 识别项目技术栈
- 前端框架：React / Vue / Angular / Next.js / Nuxt.js / UmiJS
- 构建工具：Vite / Webpack / Rollup / Turbopack
- 状态管理：Redux / Zustand / Pinia / Vuex / MobX
- UI 框架：Ant Design / Element Plus / Material-UI
- 包管理器：npm / yarn / pnpm

# 定位关键配置文件
- 构建配置：vite.config.ts / webpack.config.js / next.config.js / config/config.ts
- 环境配置：.env.* / config/env.ts / config/apiConfig.ts
- 路由配置：routes.ts / router/index.ts / pages/
- API 封装：services/ / api/ / utils/request.ts
```

### 3. 七大类性能检测

#### 检测类别 1：前端接口调用规范

**检测要点：**

**A. RESTful 规范与请求头统一**
```typescript
// ✅ 正确示例
const request = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Version': 'v1',
  },
});

// ❌ 错误示例
fetch('http://localhost:8080/api/users'); // 硬编码 URL
```

**检测清单：**
- [ ] 接口地址通过环境变量管理，无硬编码 URL
- [ ] 统一封装 axios/fetch 实例，配置全局请求头
- [ ] GET/POST/PUT/DELETE 语义正确，无滥用 POST
- [ ] 请求头包含 Content-Type、Authorization、version

**B. 请求优化与防护**
```typescript
// ✅ 防抖搜索
const debouncedSearch = useMemo(
  () => debounce((keyword: string) => {
    searchAPI(keyword);
  }, 300),
  []
);

// ✅ 请求取消
useEffect(() => {
  const controller = new AbortController();
  fetchData({ signal: controller.signal });
  return () => controller.abort();
}, []);

// ❌ 错误示例：高频无防护
<input onChange={(e) => searchAPI(e.target.value)} />
```

**检测清单：**

- [ ] 搜索/输入场景配置防抖（300-500ms）
- [ ] 滚动/resize 场景配置节流（100-200ms）
- [ ] 路由切换时取消未完成请求（AbortController）
- [ ] 同类型接口合并为批量接口
- [ ] 配置超时时间（10-15s）和重试机制（幂等请求≤3次）

**C. 缓存与降级策略**
```typescript
// ✅ 内存缓存 + 本地缓存
const useCache = (key: string, fetcher: () => Promise<any>) => {
  const [data, setData] = useState(() => {
    // 优先读取内存缓存
    const cached = memoryCache.get(key);
    if (cached && !cached.expired) return cached.data;

    // 其次读取本地缓存
    const local = localStorage.getItem(key);
    return local ? JSON.parse(local) : null;
  });

  useEffect(() => {
    if (!data) {
      fetcher().then(res => {
        memoryCache.set(key, res, 3600); // 1小时
        localStorage.setItem(key, JSON.stringify(res));
        setData(res);
      });
    }
  }, [key]);

  return data;
};

// ❌ 错误示例：无缓存，重复请求
useEffect(() => {
  fetchCategories(); // 每次渲染都请求
}, []);
```

**检测清单：**
- [ ] 高频低变数据（分类/配置）配置缓存
- [ ] 缓存包含有效期和标签管理
- [ ] 接口失败有降级方案（缓存数据/空状态）
- [ ] 后端返回统一格式 {code, msg, data}
- [ ] 响应拦截器统一处理异常

---

#### 检测类别 2：浏览器缓存策略

**检测要点：**

**A. HTTP 缓存配置**

```nginx
# ✅ Nginx 静态资源缓存配置
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# ✅ API 接口缓存
location /api/config {
    proxy_pass http://backend;
    add_header Cache-Control "public, max-age=3600"; # 1小时
}

# ❌ 错误示例：无缓存配置
location / {
    # 默认 no-cache，每次都请求服务器
}
```

**检测清单：**
- [ ] 静态资源配置 `Cache-Control: public, max-age=31536000, immutable`
- [ ] 静态资源文件名包含内容哈希（如 app.8f2d1e.js）
- [ ] API 接口按变更频率配置合理 max-age（10s-3600s）
- [ ] 配合 Expires 头做降级兼容
- [ ] 非静态资源配置 ETag/Last-Modified 协商缓存

**B. 本地存储策略**
```typescript
// ✅ 按数据特性选择存储
// LocalStorage：持久化、低频变、非敏感
localStorage.setItem('user-preferences', JSON.stringify(prefs));

// SessionStorage：会话临时、表单草稿
sessionStorage.setItem('form-draft', JSON.stringify(formData));

// IndexedDB：大量结构化数据
const db = await openDB('my-database', 1);
await db.put('products', largeProductList);

// ❌ 错误示例：滥用 LocalStorage
localStorage.setItem('token', token); // 敏感信息不应存本地
localStorage.setItem('large-data', JSON.stringify(bigArray)); // 超过 5MB 限制
```

**检测清单：**
- [ ] 低频变持久化数据用 LocalStorage
- [ ] 会话临时数据用 SessionStorage
- [ ] 大量结构化数据用 IndexedDB
- [ ] 无敏感信息（token/密码）存储在本地
- [ ] LocalStorage 使用量 < 5MB

---

#### 检测类别 3：前端状态管理

**检测要点：**

**A. 状态分层与作用域**
```typescript
// ✅ 全局状态：登录态、全局配置
const useUserStore = create((set) => ({
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
}));

// ✅ 页面状态：列表、筛选
const [list, setList] = useState([]);
const [filters, setFilters] = useState({});

// ✅ 组件状态：表单输入、按钮加载
const [loading, setLoading] = useState(false);

// ❌ 错误示例：全局存储页面状态
const useGlobalStore = create((set) => ({
  productList: [], // 应该是页面状态
  searchKeyword: '', // 应该是组件状态
}));
```

**检测清单：**
- [ ] 全局状态仅存储跨页面共享数据
- [ ] 页面状态用组件内部状态管理
- [ ] 临时状态用组件局部状态
- [ ] 按业务模块拆分 store（userStore/productStore）
- [ ] 组件按需订阅状态，无全量订阅

**B. 状态更新与持久化**
```typescript
// ✅ 不可变更新
const addItem = (item) => {
  setList([...list, item]); // 扩展运算符
  // 或
  setList(list.concat(item)); // concat
};

// ✅ 持久化全局状态
const useUserStore = create(
  persist(
    (set) => ({
      user: null,
      login: (user) => set({ user }),
    }),
    { name: 'user-storage' }
  )
);

// ❌ 错误示例：直接修改原数据
list.push(item); // 不会触发重渲染
setList(list);
```

**检测清单：**
- [ ] 状态更新遵循不可变原则
- [ ] 核心全局状态（登录态）持久化到 LocalStorage
- [ ] 状态更新后正确触发组件重渲染
- [ ] 无直接修改 state 导致的 bug

---

#### 检测类别 4：资源加载优化

**检测要点：**

**A. 图片优化**
```tsx
// ✅ Next.js Image 组件
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Hero"
  width={800}
  height={600}
  priority // 首屏图片
  placeholder="blur"
/>

// ✅ 响应式图片
<img
  src="/image.jpg"
  srcSet="/image-320w.jpg 320w, /image-640w.jpg 640w, /image-1280w.jpg 1280w"
  sizes="(max-width: 320px) 280px, (max-width: 640px) 600px, 1200px"
  loading="lazy" // 懒加载
  alt="Responsive"
/>

// ❌ 错误示例：大图直接加载
<img src="/hero-original-5mb.jpg" /> // 未压缩、未懒加载
```

**检测清单：**
- [ ] 图片使用 WebP/AVIF 格式
- [ ] 配置 srcset/sizes 响应式加载
- [ ] 非首屏图片配置 loading="lazy"
- [ ] 使用框架专属优化组件（next/image）
- [ ] 图片资源接入 CDN

**B. 代码分割与懒加载**
```typescript
// ✅ 路由级代码分割
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));

<Suspense fallback={<Loading />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/profile" element={<Profile />} />
  </Routes>
</Suspense>

// ✅ 组件级懒加载
const HeavyChart = lazy(() => import('./components/HeavyChart'));

// ❌ 错误示例：全量导入
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Settings from './pages/Settings'; // 所有页面打进主 bundle
```

**检测清单：**
- [ ] 实现路由级代码分割
- [ ] 大组件（图表/编辑器）懒加载
- [ ] 非首屏模块延迟加载
- [ ] 配置 Suspense 加载状态

---

#### 检测类别 5：打包体积优化

**检测要点：**

**A. 依赖按需引入**
```typescript
// ✅ 按需引入 UI 组件
import { Button, Modal } from 'antd';

// ✅ 按需引入图标
import { UserOutlined, SettingOutlined } from '@ant-design/icons';

// ✅ Tree Shaking 友好的导入
import debounce from 'lodash-es/debounce';

// ❌ 错误示例：整包引入
import * as antd from 'antd'; // 整个 antd 打进 bundle
import * as icons from '@ant-design/icons'; // 所有图标
import _ from 'lodash'; // 整个 lodash（非 ES 模块）
```

**检测清单：**
- [ ] UI 组件库按需引入
- [ ] 图标库按需引入
- [ ] 工具库使用 ES 模块版本（lodash-es）
- [ ] 清理未使用的依赖包
- [ ] 大体积 SDK 按需加载

**B. 资源拆分与抽离**
```javascript
// ✅ Vite 配置
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['antd', '@ant-design/icons'],
          'vendor-charts': ['echarts', '@antv/g2'],
        },
      },
    },
  },
});

// ✅ Webpack 配置
optimization: {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        priority: 10,
      },
    },
  },
}

// ❌ 错误示例：无拆分配置，所有代码打进一个 bundle
```

**检测清单：**
- [ ] 公共依赖抽离为独立 chunk
- [ ] 大体积资源（JSON/SDK）按需加载
- [ ] 配置合理的 chunk 拆分策略
- [ ] 主 bundle 体积 < 500KB（gzip 后）

---

#### 检测类别 6：网络传输优化

**检测要点：**

**A. HTTP 缓存与压缩**
```nginx
# ✅ Nginx 配置
# GZIP 压缩
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

# Brotli 压缩（更高压缩率）
brotli on;
brotli_types text/plain text/css application/javascript application/json;

# HTTP/2
listen 443 ssl http2;

# ❌ 错误示例：无压缩配置
gzip off; # 传输体积大 3-5 倍
```

**检测清单：**
- [ ] 开启 GZIP/Brotli 压缩
- [ ] 静态资源配置长缓存
- [ ] 升级到 HTTP/2/HTTP/3
- [ ] 静态资源接入 CDN
- [ ] 配置 preconnect/preload

**B. 资源预加载**
```html
<!-- ✅ 预连接 CDN -->
<link rel="preconnect" href="https://cdn.example.com">
<link rel="dns-prefetch" href="https://api.example.com">

<!-- ✅ 预加载关键资源 -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/critical.css" as="style">

<!-- ✅ 预取下一页资源 -->
<link rel="prefetch" href="/next-page.js">

<!-- ❌ 错误示例：无预加载，首屏等待字体/CSS 下载 -->
```

**检测清单：**
- [ ] CDN 域名配置 preconnect
- [ ] 首屏关键资源配置 preload
- [ ] 下一页资源配置 prefetch
- [ ] 字体文件配置 preload + crossorigin

---

#### 检测类别 7：渲染性能优化

**检测要点：**

**A. 组件渲染优化**
```typescript
// ✅ React.memo 缓存组件
const ProductCard = React.memo(({ product }) => {
  return <div>{product.name}</div>;
});

// ✅ useMemo 缓存计算结果
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);

// ✅ useCallback 稳定函数引用
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

// ❌ 错误示例：每次渲染创建新对象/函数
<Child data={{ id: 1 }} /> // 每次渲染新对象
<Child onClick={() => {}} /> // 每次渲染新函数
```

**检测清单：**
- [ ] 纯展示组件使用 React.memo/Vue computed
- [ ] 复杂计算使用 useMemo 缓存
- [ ] 传递给子组件的函数使用 useCallback
- [ ] 依赖数组不包含不稳定对象/数组/函数
- [ ] 状态拆分，避免全局大状态

**B. 长列表优化**
```typescript
// ✅ 虚拟列表
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={10000}
  itemSize={50}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>Item {index}</div>
  )}
</FixedSizeList>

// ❌ 错误示例：直接渲染大列表
{list.map(item => <Item key={item.id} data={item} />)} // 10000+ 条
```

**检测清单：**
- [ ] 单屏展示 > 20 条使用虚拟列表
- [ ] 使用 react-window/vue-virtual-scroller
- [ ] 配置合理的 itemSize 和 overscanCount
- [ ] 长列表滚动流畅（60fps）

**C. 动画性能**
```css
/* ✅ 使用合成属性 */
.box {
  transform: translateX(100px); /* GPU 加速 */
  opacity: 0.5;
}

/* ❌ 错误示例：使用非合成属性 */
.box {
  left: 100px; /* 触发布局 */
  width: 200px; /* 触发布局 */
}
```

**检测清单：**
- [ ] 动画使用 transform/opacity
- [ ] 避免使用 width/height/top/left
- [ ] 高频事件配置节流/防抖
- [ ] 动画帧率 ≥ 60fps

---

### 4. 性能指标检测

**Web Vitals 核心指标：**

```bash
# 使用 Lighthouse 检测
npx lighthouse https://your-site.com --view

# 使用 Chrome DevTools
# Performance 面板 → 录制 → 分析

# 关键指标
- LCP (Largest Contentful Paint) ≤ 2.5s  # 最大内容绘制
- FID (First Input Delay) ≤ 100ms        # 首次输入延迟
- CLS (Cumulative Layout Shift) ≤ 0.1    # 累积布局偏移
- FCP (First Contentful Paint) ≤ 1.8s    # 首次内容绘制
- TTI (Time to Interactive) ≤ 3.8s       # 可交互时间
```

**检测清单：**
- [ ] 首屏加载时间 ≤ 2s
- [ ] LCP ≤ 2.5s
- [ ] FID ≤ 100ms
- [ ] CLS ≤ 0.1
- [ ] Lighthouse 评分 ≥ 90

---

### 5. 输出优化报告

**报告结构：**

```markdown
# 前端性能优化报告

## 项目信息
- 项目名称：xxx
- 技术栈：React 18 + Vite + Ant Design
- 检测时间：2026-02-04
- 检测范围：全面检测

## 问题汇总
### 🔴 必须修复（影响用户体验）
1. 【接口调用】搜索输入无防抖，高频触发接口（src/pages/Search.tsx:45）
2. 【渲染性能】长列表未使用虚拟滚动，渲染 5000+ 条数据（src/pages/ProductList.tsx:120）
3. 【打包体积】整包引入 antd，主 bundle 体积 2.3MB（config/vite.config.ts）

### 🟡 建议优化（提升性能）
1. 【缓存策略】分类接口无缓存，每次切换页面重复请求（src/services/category.ts:20）
2. 【资源加载】首屏大图未懒加载，阻塞 LCP（src/pages/Home.tsx:30）

### 🟢 可选增强（锦上添花）
1. 【网络优化】未配置 CDN 预连接（public/index.html）
2. 【状态管理】部分页面状态可抽离为全局状态（src/pages/Cart.tsx）

## 优化方案

### 1. 搜索防抖优化
**问题：** src/pages/Search.tsx:45 输入框每次输入都触发接口

**方案：**
\`\`\`typescript
// 修改前
<Input onChange={(e) => searchAPI(e.target.value)} />

// 修改后
const debouncedSearch = useMemo(
  () => debounce((keyword: string) => {
    searchAPI(keyword);
  }, 300),
  []
);

<Input onChange={(e) => debouncedSearch(e.target.value)} />
\`\`\`

**预期效果：** 减少 80% 无效请求，输入流畅度提升

---

### 2. 长列表虚拟滚动
**问题：** src/pages/ProductList.tsx:120 直接渲染 5000+ 条数据

**方案：**
\`\`\`typescript
// 修改前
{list.map(item => <ProductCard key={item.id} data={item} />)}

// 修改后
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={list.length}
  itemSize={120}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <ProductCard data={list[index]} />
    </div>
  )}
</FixedSizeList>
\`\`\`

**预期效果：** 首屏渲染时间从 3.5s 降至 0.8s，滚动流畅度提升至 60fps

---

## 性能指标对比

| 指标 | 优化前 | 优化后 | 目标 |
|------|--------|--------|------|
| 首屏加载 | 4.2s | 1.8s | ≤ 2s |
| LCP | 3.8s | 2.1s | ≤ 2.5s |
| FID | 250ms | 80ms | ≤ 100ms |
| 主 bundle | 2.3MB | 580KB | < 500KB |
| Lighthouse | 65 | 92 | ≥ 90 |

## 落地清单

### 第一阶段（必须修复，1-2 天）
- [ ] 搜索防抖优化
- [ ] 长列表虚拟滚动
- [ ] antd 按需引入

### 第二阶段（建议优化，3-5 天）
- [ ] 分类接口缓存
- [ ] 图片懒加载
- [ ] 代码分割

### 第三阶段（可选增强，1 周）
- [ ] CDN 预连接
- [ ] 状态管理优化
- [ ] HTTP/2 升级
\`\`\`

---

## 注意事项

### 检测前提
1. **项目可运行**：确保项目可以正常启动和构建
2. **依赖已安装**：npm install / yarn / pnpm install
3. **环境配置正确**：.env 文件配置完整

### 检测工具
- **静态分析**：ESLint、TypeScript、Webpack Bundle Analyzer
- **性能检测**：Lighthouse、Chrome DevTools、Web Vitals
- **代码扫描**：Grep、AST 解析

### 输出原则
1. **问题必有依据**：每个问题必须指出具体文件和行号
2. **方案必可落地**：提供完整代码示例，不只是理论
3. **效果必可量化**：给出优化前后的性能对比数据
4. **优先级必明确**：区分必须修复/建议优化/可选增强

### 兼容性保障
- 所有优化方案使用稳定 API，无实验性特性
- 优化后功能无异常，无浏览器兼容性问题
- 提供降级方案（如不支持 HTTP/2 时的处理）

## 相关文档

- [Web Vitals 官方文档](https://web.dev/vitals/)
- [React 性能优化指南](https://react.dev/learn/render-and-commit)
- [HTTP 缓存最佳实践](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Webpack 优化指南](https://webpack.js.org/guides/build-performance/)

## 常见问题

**Q: 检测需要多长时间？**
A: 全面检测约 30-60 分钟，单项检测约 10-20 分钟

**Q: 优化后性能提升多少？**
A: 根据项目现状，通常可提升 30%-80%，具体以实测为准

**Q: 优化会影响现有功能吗？**
A: 不会，所有优化方案都经过验证，确保功能正常

**Q: 需要重构代码吗？**
A: 大部分优化无需重构，仅需局部调整，重构建议会单独标注
