const fs = require('fs');
const h = fs.readFileSync('dist/index.html', 'utf8');
const style = h.match(/<style>([\s\S]*?)<\/style>/);
console.log('HTML 总长:', h.length);
console.log('style 内 CSS 长:', style ? style[1].length : 0);
console.log('script 引用:', h.match(/src="[^"]+"/g));
// 统计字符频率（CSS 内）
if (style) {
    const css = style[1];
    const freq = {};
    for (const c of css) freq[c] = (freq[c] || 0) + 1;
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20);
    console.log('CSS 字符频率 top:', top.map(([k, v]) => `${JSON.stringify(k)}:${v}`).join(' '));
    // 十六进制颜色
    const colors = [...new Set(css.match(/#[0-9a-fA-F]{3,6}/g) || [])];
    console.log('CSS hex 颜色:', colors.join(' '));
    // 可去重选择器
    const props = css.match(/[a-z-]+(?=\s*:)/g) || [];
    const pf = {};
    props.forEach(p => pf[p] = (pf[p] || 0) + 1);
    console.log('CSS 属性分布:', Object.entries(pf).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${k}:${v}`).join(' '));
}
