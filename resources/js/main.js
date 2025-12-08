const { createApp, ref, onMounted } = Vue;

Neutralino.init();

Neutralino.events.on("windowClose", () => {
  Neutralino.app.exit();
});

const app = createApp({
  setup() {
    const result = ref("");
    const searchQuery = ref("");
    const searchHistory = ref([]);

    // コトバンク該当ページからのスクレイピング
    const getEntry = async (button) => {
      // 入力のフォーマット
      const replacements = {
        ä: "a",
        ö: "o",
        ü: "u",
        ß: "ss",
        é: "e",
      };
      const word = button || searchQuery.value;
      const formated = word.replace(
        /ä|ö|ü|ß|é/gi,
        (match) => replacements[match.toLowerCase()],
      );

      // キャッシュがあればそれを表示する
      try {
        const cache = await Neutralino.storage.getData(formated);
        result.value = cache;

        // 履歴に追加
        button || searchHistory.value.unshift(searchQuery.value);
      } catch {
        try {
          // HTMLを取得するPoweshellコマンド
          const targetUrl = `https://kotobank.jp/dejaword/${formated}`;
          const command = `powershell -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; (Invoke-WebRequest -Uri '${targetUrl}' -UseBasicParsing).Content"`;

          // コマンド実行
          const data = await Neutralino.os.execCommand(command);
          const rawHTML = data.stdOut;

          // HTMLをパース
          const parser = new DOMParser();
          const doc = parser.parseFromString(rawHTML, "text/html");

          // 説明文部分の抜き出し
          const description = doc.querySelector(".dictype.cf.pgj");
          // 広告の削除
          description.querySelector(".kyujinbox-ad").remove();
          // 見出しの削除
          description.querySelector("h2").remove();
          // リンクの無効化とアンダーラインの削除
          description.querySelectorAll("a").forEach((item) => {
            item.style.pointerEvents = "none";
            item.style.textDecoration = "none";
          });
          // 情報ページへのリンクの削除
          description.querySelectorAll("small").forEach((item) => {
            if (item.querySelector("a")) {
              item.remove();
            }
          });

          // HTMLに反映
          result.value = description.innerHTML;

          // 履歴に追加
          button || searchHistory.value.unshift(searchQuery.value);

          // キャッシュ
          button ||
            (await Neutralino.storage.setData(
              searchQuery.value,
              description.innerHTML,
            ));
        } catch (error) {
          console.error(error);
        }
      }

      // 検索クエリをリセット
      searchQuery.value = "";
    };

    // 履歴削除ボタン
    const removeHistory = (item) => {
      searchHistory.value = searchHistory.value.filter(
        (history) => history !== item,
      );
    };

    return {
      result,
      getEntry,
      searchQuery,
      searchHistory,
      removeHistory,
    };
  },
});

app.use(PrimeVue.Config, {
  theme: {
    preset: PrimeUIX.Themes.Aura,
  },
});

app
  .component("p-card", PrimeVue.Card)
  .component("p-inputtext", PrimeVue.InputText)
  .component("p-inputicon", PrimeVue.InputIcon)
  .component("p-iconfield", PrimeVue.IconField)
  .component("p-button", PrimeVue.Button)
  .component("p-divider", PrimeVue.Divider);

app.mount("#app");
