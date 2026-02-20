import { useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/composed/page-header';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';

export default function BasicSettingsPage() {
  const {
    siteName,
    siteSubtitle,
    logoUrl,
    showDashboardHero,
    setSiteName,
    setSiteSubtitle,
    setLogoUrl,
    setShowDashboardHero,
    resetAll,
    fetchSettings,
  } = useSiteSettingsStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setLogoUrl(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <PageHeader title="基础参数" description="配置系统名称、Logo 等基本信息" />

      {/* ---- Site Identity ---- */}
      <Card className="gap-4 py-5">
        <CardHeader className="py-0">
          <CardTitle className="text-sm">站点信息</CardTitle>
          <CardDescription className="text-xs">修改后自动同步到服务器</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30">
              <img
                src={logoUrl}
                alt="Logo"
                className="size-10 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/logo.svg';
                }}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Logo</label>
              <div className="flex items-center gap-2">
                <Input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="Logo URL 或上传图片"
                  className="flex-1 text-xs h-8"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0"
                >
                  <Icon icon="lucide:upload" width={14} height={14} />
                  上传
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoFile}
                />
              </div>
            </div>
          </div>

          {/* Site Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">系统名称</label>
            <Input
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="MutiExpert"
              className="text-sm h-9"
            />
          </div>

          {/* Site Subtitle */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">系统副标题</label>
            <Input
              value={siteSubtitle}
              onChange={(e) => setSiteSubtitle(e.target.value)}
              placeholder="知识管理平台"
              className="text-sm h-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* ---- Display Options ---- */}
      <Card className="gap-4 py-5">
        <CardHeader className="py-0">
          <CardTitle className="text-sm">显示选项</CardTitle>
          <CardDescription className="text-xs">控制页面元素的显示与隐藏</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">仪表盘 Hero 区域</label>
              <p className="text-xs text-muted-foreground">显示仪表盘顶部的 Logo、标题和副标题</p>
            </div>
            <Switch checked={showDashboardHero} onCheckedChange={setShowDashboardHero} />
          </div>
        </CardContent>
      </Card>

      {/* ---- Reset ---- */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={resetAll} className="text-xs">
          <Icon icon="lucide:rotate-ccw" width={14} height={14} />
          恢复默认值
        </Button>
      </div>
    </div>
  );
}
