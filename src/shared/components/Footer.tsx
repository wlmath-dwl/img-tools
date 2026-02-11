import { useI18n } from "../../i18n/context";

export function Footer() {
  const { t } = useI18n();

  return (
    <footer class="mt-[18px] text-slate-600 dark:text-slate-300 text-xs w-full mx-auto px-[18px] pb-7">
      <div class="max-w-[1040px] mx-auto text-center space-y-1">
        {/* 关键词链接 */}
        <div class="text-[11px] text-slate-600 dark:text-slate-300 mb-1">
          {t("footer.hotTools")}
          <a href="./pages/image-pdf.html" class="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">{t("footer.hotTools.jpgToPdf")}</a>
          {' | '}
          <a href="./pages/image-pdf.html" class="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">{t("footer.hotTools.pngToPdf")}</a>
          {' | '}
          <a href="./pages/image-pdf.html" class="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">{t("footer.hotTools.webpToPdf")}</a>
          {' | '}
          <a href="./pages/image-compress.html" class="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">{t("footer.hotTools.compress")}</a>
          {' | '}
          <a href="./pages/image-watermark.html" class="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">{t("footer.hotTools.watermark")}</a>
        </div>

        <div>
          <a
            href="../index.html"
            class="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            {t("footer.allTools")}
          </a>
          {" | "}
          <a
            href="#"
            class="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            {t("footer.privacy")}
          </a>
          {" | "}
          <a
            href="#"
            class="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            {t("footer.terms")}
          </a>
          {" | "}
          <a
            href="#"
            class="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            {t("footer.cookie")}
          </a>
        </div>
        <div>{t("footer.copyright")}</div>
      </div>
    </footer>
  );
}

