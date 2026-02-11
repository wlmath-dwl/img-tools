import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { useI18n } from "../../i18n/context";
import { locales } from "../../i18n/locales";
import type { TranslationKey } from "../../i18n/types";
import { Header } from "../../shared/components/Header";
import { Footer } from "../../shared/components/Footer";
import {
  CropIcon,
  CompressIcon,
  MosaicIcon,
  WatermarkIcon,
  ConvertIcon,
  FilterIcon,
  PrivacyShieldIcon,
  GlobeIcon,
  FreeIcon,
} from "../../shared/icons";
import { ImageUploadArea } from "../../shared/components/ImageUploadArea";

type ToolCard = {
  title: string;
  description: string;
  href: string;
  icon?: ComponentChildren;
};

const STORAGE_KEY = "img-tools-pdf-files-from-home";

// 将文件存储到sessionStorage
async function storeFilesToSessionStorage(files: File[]): Promise<void> {
  const fileData = await Promise.all(
    files.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      return {
        name: file.name,
        type: file.type,
        size: file.size,
        data: Array.from(new Uint8Array(arrayBuffer)), // 转换为普通数组以便JSON序列化
      };
    }),
  );
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fileData));
}

export function Home() {
  const { t, locale } = useI18n();

  // 动态注入 SEO Meta 标签
  useEffect(() => {
    document.title = t("seo.home.title");
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", t("seo.home.description"));
    }

    // 动态生成 Canonical 和 Hreflang
    const baseUrl = "https://imgtools365.com";
    
    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    const langPath = locale === "zh-CN" ? "" : `/${locale}`;
    canonical.setAttribute("href", `${baseUrl}${langPath}/`);

    // Hreflang
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove());
    
    locales.forEach(l => {
      const link = document.createElement("link");
      link.setAttribute("rel", "alternate");
      link.setAttribute("hreflang", l);
      const lPath = l === "zh-CN" ? "" : `/${l}`;
      link.setAttribute("href", `${baseUrl}${lPath}/`);
      document.head.appendChild(link);
    });

    // x-default
    const xDefault = document.createElement("link");
    xDefault.setAttribute("rel", "alternate");
    xDefault.setAttribute("hreflang", "x-default");
    xDefault.setAttribute("href", `${baseUrl}/`);
    document.head.appendChild(xDefault);
  }, [t, locale]);

  const compressNavKey: TranslationKey = "nav.imageCompress";

  // 上传图片后存储数据并跳转到PDF页面
  async function handleFilesSelect(files: File[]) {
    if (files.length > 0) {
      try {
        await storeFilesToSessionStorage(files);
        window.location.href = "./pages/image-pdf.html";
      } catch (error) {
        console.error("存储文件数据失败:", error);
        // 即使存储失败也跳转，用户可以在PDF页面重新上传
        window.location.href = "./pages/image-pdf.html";
      }
    }
  }

  const allTools: ToolCard[] = [
    {
      title: t("nav.imageCrop"),
      description: t("home.tool.crop.desc"),
      href: "./pages/image-crop.html",
      icon: <CropIcon size={40} />,
    },
    {
      title: t(compressNavKey),
      description: t("home.tool.compress.desc"),
      href: "./pages/image-compress.html",
      icon: <CompressIcon size={40} />,
    },
    {
      title: t("nav.imageMosaic"),
      description: t("home.tool.mosaic.desc"),
      href: "./pages/image-mosaic.html",
      icon: <MosaicIcon size={40} />,
    },
    {
      title: t("nav.imageWatermark"),
      description: t("home.tool.watermark.desc"),
      href: "./pages/image-watermark.html",
      icon: <WatermarkIcon size={40} />,
    },
    {
      title: t("nav.imageConvert"),
      description: t("home.tool.convert.desc"),
      href: "./pages/image-convert.html",
      icon: <ConvertIcon size={40} />,
    },
    {
      title: t("nav.imageFilter"),
      description: t("home.tool.filter.desc"),
      href: "./pages/image-filter.html",
      icon: <FilterIcon size={40} />,
    },
    {
      title: t("nav.imagePdf"),
      description: t("home.how.step1.descPrefix") + t("home.how.step1.descEmphasis") + t("home.how.step1.descSuffix"),
      href: "./pages/image-pdf.html",
      icon: <div class="w-10 h-10 flex items-center justify-center bg-primary/10 rounded-lg text-primary"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg></div>,
    }
  ];

  return (
    <div class="w-full min-h-screen flex flex-col">
      <Header />

      <main class="flex-1 min-h-[calc(100vh-4rem)] flex flex-col gap-3.5">
        <div class="max-w-[1040px] w-full mx-auto px-[18px] py-7 flex flex-col gap-3.5">
          {/* Hero 区 */}
          <section class="mb-10 mt-4 text-center">
            <h1 class="text-4xl md:text-5xl font-bold mb-12 text-base-content">
              {t("home.title")}
            </h1>
            
            <p class="text-lg mb-10 text-base-content/80 max-w-2xl mx-auto font-medium">
              {t("home.hero.subtitle")}
            </p>

            {/* 上传区域 */}
            <div class="mb-8">
              <ImageUploadArea
                onFilesSelect={handleFilesSelect}
                acceptedTypes="image/jpeg,image/png,image/webp"
                texts={{
                  buttonLabel: t("home.upload.button"),
                  description: t("home.upload.desc"),
                }}
              />
            </div>

            {/* 为什么选择我们 */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-3xl mx-auto">
              <div class="flex flex-col items-center text-center gap-2">
                <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 text-primary">
                  <PrivacyShieldIcon size={24} />
                </div>
                <h3 class="font-semibold text-base text-base-content">
                  {t("home.usp.privacy.title")}
                </h3>
                <p class="text-sm text-base-content/70">
                  {t("home.usp.privacy.desc")}
                </p>
              </div>
              <div class="flex flex-col items-center text-center gap-2">
                <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 text-primary">
                  <GlobeIcon size={24} />
                </div>
                <h3 class="font-semibold text-base text-base-content">
                  {t("home.usp.global.title")}
                </h3>
                <p class="text-sm text-base-content/70">
                  {t("home.usp.global.desc")}
                </p>
              </div>
              <div class="flex flex-col items-center text-center gap-2">
                <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 text-primary">
                  <FreeIcon size={24} />
                </div>
                <h3 class="font-semibold text-base text-base-content">
                  {t("home.usp.free.title")}
                </h3>
                <p class="text-sm text-base-content/70">
                  {t("home.usp.free.desc")}
                </p>
              </div>
            </div>
          </section>

          {/* 工具卡片入口 */}
          <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {allTools.map((tool: ToolCard) => (
              <a
                key={tool.href}
                href={tool.href}
                class="border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 rounded-[14px] p-3.5 hover:shadow-lg transition-shadow cursor-pointer group"
              >
                <div class="flex items-start gap-4">
                  {tool.icon && (
                    <div class="flex-shrink-0 text-base-content/70 group-hover:text-base-content group-hover:scale-110 transition-all">
                      {tool.icon}
                    </div>
                  )}
                  <div class="flex-1">
                    <h2 class="m-0 mb-2.5 text-base font-bold text-base-content/90 group-hover:text-base-content transition-colors">
                      {tool.title}
                    </h2>
                    <p class="text-sm text-base-content/70">
                      {tool.description}
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </section>

          {/* 关于图片转PDF工具 */}
          <section class="w-full bg-base-200/50 dark:bg-slate-800/30 py-16 px-4 md:px-8 -mx-[18px] md:-mx-0">
            <div class="max-w-[800px] mx-auto flex flex-col md:flex-row gap-8 md:gap-10 items-start">
              {/* 左侧标题和说明 */}
              <div class="flex-1">
                <h2 class="text-2xl md:text-3xl font-bold mb-4 text-base-content">
                  {t("home.how.title")}
                </h2>
                <p
                  class="text-base text-base-content/70"
                  style={{ lineHeight: "1.8" }}
                >
                  {t("home.how.descPrefix")}
                  <strong class="text-base-content font-semibold">
                    {t("home.how.descEmphasis")}
                  </strong>
                  {t("home.how.descSuffix")}
                </p>
              </div>

              {/* 右侧步骤卡片 */}
              <div class="flex-2 w-full md:w-auto grid gap-5 md:min-w-[500px]">
                <div class="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <div class="flex items-start gap-3">
                    <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      01
                    </div>
                    <div class="flex-1">
                      <strong class="text-base-content font-semibold block mb-1">
                        {t("home.how.step1.title")}
                      </strong>
                      <p
                        class="text-sm text-base-content/70"
                        style={{ lineHeight: "1.8" }}
                      >
                        {t("home.how.step1.descPrefix")}
                        <strong class="text-base-content">
                          {t("home.how.step1.descEmphasis")}
                        </strong>
                        {t("home.how.step1.descSuffix")}
                      </p>
                    </div>
                  </div>
                </div>

                <div class="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <div class="flex items-start gap-3">
                    <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      02
                    </div>
                    <div class="flex-1">
                      <strong class="text-base-content font-semibold block mb-1">
                        {t("home.how.step2.title")}
                      </strong>
                      <p
                        class="text-sm text-base-content/70"
                        style={{ lineHeight: "1.8" }}
                      >
                        {t("home.how.step2.desc")}
                      </p>
                    </div>
                  </div>
                </div>

                <div class="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <div class="flex items-start gap-3">
                    <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      03
                    </div>
                    <div class="flex-1">
                      <strong class="text-base-content font-semibold block mb-1">
                        {t("home.how.step3.title")}
                      </strong>
                      <p
                        class="text-sm text-base-content/70"
                        style={{ lineHeight: "1.8" }}
                      >
                        {t("home.how.step3.descPrefix")}
                        <strong class="text-base-content">
                          {t("home.how.step3.descEmphasis")}
                        </strong>
                        {t("home.how.step3.descSuffix")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}


