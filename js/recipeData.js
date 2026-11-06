// CSVを読み込み、食材名をキーにしたMapを返す
export async function loadRecipes() {

    // このJavaScriptファイルを基準にCSVの場所を指定する
    const csvUrl = new URL(
        "../data/ingredient_recipes.csv",
        import.meta.url
    );

    const response = await fetch(csvUrl);

    if (!response.ok) {
        throw new Error(
            `CSVを読み込めませんでした。HTTP状態：${response.status}`
        );
    }

    // CSV全体を文字列として取得する
    const text = await response.text();

    // 先頭にBOMがあれば取り除く
    const csvText = text.replace(/^\uFEFF/, "");

    // 改行で分割し、行の配列にする
    const lines = csvText.split(/\r\n|\n|\r/);

    // 先頭の見出し行を取り出す
    const header = lines.shift();

    if (header !== "食材名,料理名") {
        throw new Error(
            "CSVの1行目は「食材名,料理名」にしてください。"
        );
    }

    const recipes = new Map();

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];

        // 空行は読み飛ばす
        if (line.trim() === "") {
            continue;
        }

        const data = line.split(",");

        // 見出し行の分を含めて行番号を計算する
        const lineNumber = index + 2;

        if (data.length !== 2) {
            throw new Error(
                `CSVの${lineNumber}行目：2列にしてください。`
            );
        }

        const ingredientName = data[0].trim();
        const recipeName = data[1].trim();

        if (ingredientName === "" || recipeName === "") {
            throw new Error(
                `CSVの${lineNumber}行目：食材名または料理名が空欄です。`
            );
        }

        // 未登録の食材なら、空の配列を用意する
        if (!recipes.has(ingredientName)) {
            recipes.set(ingredientName, []);
        }

        const recipeNames = recipes.get(ingredientName);

        // 同じ料理名は重複登録しない
        if (!recipeNames.includes(recipeName)) {
            recipeNames.push(recipeName);
        }
    }

    if (recipes.size === 0) {
        throw new Error("CSVに料理のデータがありません。");
    }

    return recipes;
}