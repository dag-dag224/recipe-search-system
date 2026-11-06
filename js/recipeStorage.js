// このアプリ専用の保存名
const STORAGE_KEY = "recipeWeb.additionalRecipes.v1";

// 保存データの形式が正しいか確認する
function isValidEntry(entry) {
    return (
        entry !== null
        && typeof entry === "object"
        && typeof entry.ingredientName === "string"
        && typeof entry.recipeName === "string"
        && entry.ingredientName.trim() !== ""
        && entry.recipeName.trim() !== ""
        && !/[,\r\n]/.test(entry.ingredientName)
        && !/[,\r\n]/.test(entry.recipeName)
    );
}

// 保存済みの追加レシピを読み込む
export function loadAdditions() {
    let savedText;

    try {
        savedText = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
        throw new Error(
            "保存データを読み込めませんでした。"
            + "ブラウザーの保存設定を確認してください。"
        );
    }

    // 一度も保存していない場合
    if (savedText === null) {
        return [];
    }

    let entries;

    try {
        // 保存した文字列を、配列やオブジェクトへ戻す
        entries = JSON.parse(savedText);
    } catch (error) {
        throw new Error("保存されたレシピデータを解析できませんでした。");
    }

    if (!Array.isArray(entries) || !entries.every(isValidEntry)) {
        throw new Error("保存されたレシピデータの形式が正しくありません。");
    }

    return entries;
}

// 新しい追加レシピを、既存の保存データに追記する
export function saveAdditions(newEntries) {
    if (!Array.isArray(newEntries) || !newEntries.every(isValidEntry)) {
        throw new Error("追加するレシピデータの形式が正しくありません。");
    }

    if (newEntries.length === 0) {
        return;
    }

    const savedEntries = loadAdditions();

    // 食材名と料理名の組み合わせで重複を確認する
    const registeredPairs = new Set(
        savedEntries.map(entry =>
            JSON.stringify([entry.ingredientName, entry.recipeName])
        )
    );

    for (const entry of newEntries) {
        const pair = JSON.stringify([
            entry.ingredientName,
            entry.recipeName
        ]);

        if (registeredPairs.has(pair)) {
            continue;
        }

        savedEntries.push({
            ingredientName: entry.ingredientName,
            recipeName: entry.recipeName
        });

        registeredPairs.add(pair);
    }

    try {
        // 配列を文字列に変換して保存する
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(savedEntries)
        );
    } catch (error) {
        throw new Error(
            "レシピを保存できませんでした。"
            + "保存容量やブラウザーの保存設定を確認してください。"
        );
    }
}