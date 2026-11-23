import { loadRecipes } from "./recipeData.js";
import {
    RecipeSearch,
    isKatakanaName,
    splitIngredientNames
} from "./recipeSearch.js";
import { loadAdditions, saveAdditions } from "./recipeStorage.js";
import { setupIngredientSuggestions } from "./ingredientSuggestions.js";

// HTMLの部品を取得する
const searchScreen = document.getElementById("search-screen");
const addScreen = document.getElementById("add-screen");

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-ingredient");
const searchButton = document.getElementById("search-button");
const openAddButton = document.getElementById("open-add-button");

const resultMessage = document.getElementById("result-message");
const recipeList = document.getElementById("recipe-list");

const addForm = document.getElementById("add-form");
const recipeNameInput = document.getElementById("recipe-name");
const ingredientNamesInput = document.getElementById("ingredient-names");
const backButton = document.getElementById("back-button");

const statusMessage = document.getElementById("status-message");
const errorMessage = document.getElementById("error-message");

// 検索と追加で共有するオブジェクト
let recipeSearch = null;

// 一度に検索できる食材の数と、表示する料理の数
const MAX_SEARCH_INGREDIENTS = 10;
const MAX_SEARCH_RESULTS = 50;

// 食材名の配列を「『A』『B』」の形の文にする
function quoteNames(names) {
    return names.map(name => `「${name}」`).join("");
}

// エラーメッセージを表示する
function showError(error) {
    errorMessage.textContent =
        error instanceof Error ? error.message : String(error);

    errorMessage.hidden = false;
}

// エラーメッセージを消す
function clearError() {
    errorMessage.textContent = "";
    errorMessage.hidden = true;
}

// 検索画面を表示する
function showSearchScreen() {
    addScreen.hidden = true;
    searchScreen.hidden = false;
    searchInput.focus();
}

// 追加画面を表示する
function showAddScreen() {
    searchScreen.hidden = true;
    addScreen.hidden = false;
    recipeNameInput.focus();
}

// 検索結果を表示する
function displaySearchResults() {
    if (recipeSearch === null) {
        return;
    }

    // 前回の検索結果を消す
    recipeList.replaceChildren();

    const ingredientNames = splitIngredientNames(searchInput.value);

    if (ingredientNames.length === 0) {
        resultMessage.textContent = "食材を入力してください。";
        return;
    }

    if (ingredientNames.length > MAX_SEARCH_INGREDIENTS) {
        resultMessage.textContent =
            `食材は${MAX_SEARCH_INGREDIENTS}個までにしてください。`
            + `（今は${ingredientNames.length}個です）`;
        return;
    }

    // 全角カタカナ以外が含まれていれば、検索せずに案内する
    const invalidNames = ingredientNames.filter(
        name => !isKatakanaName(name)
    );

    if (invalidNames.length > 0) {
        resultMessage.textContent =
            `${quoteNames(invalidNames)}は全角カタカナで入力してください。`;
        return;
    }

    // 全角カタカナなら検索する
    const { total, results } = recipeSearch.searchByIngredients(
        ingredientNames,
        MAX_SEARCH_RESULTS
    );

    const inputLabel = `「${ingredientNames.join("・")}」`;

    // 登録されていない食材は、検索に使わなかったことを知らせる
    const unknownNames = ingredientNames.filter(
        name => !recipeSearch.hasIngredient(name)
    );

    if (total === 0) {
        resultMessage.textContent =
            `${inputLabel}に該当する料理はありません。`;
        return;
    }

    let message = total > MAX_SEARCH_RESULTS
        ? `${inputLabel}を使う料理：全${total}件のうち、`
            + `関連性の高い${results.length}件を表示`
        : `${inputLabel}を使う料理：${total}件`;

    if (unknownNames.length > 0) {
        message +=
            `\n${quoteNames(unknownNames)}は登録されていない食材のため、`
            + "検索に使いませんでした。";
    }

    resultMessage.textContent = message;

    for (const result of results) {
        const item = document.createElement("li");
        const link = document.createElement("a");

        // 料理名を使って検索URLを作る
        const keyword = encodeURIComponent(result.recipeName + " レシピ");

        link.href = "https://www.google.com/search?q=" + keyword;
        link.textContent = result.recipeName;

        // 新しいタブで検索結果を開く
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        item.appendChild(link);

        // 食材を複数入れたときだけ、使う食材を添える
        if (ingredientNames.length > 1) {
            const matched = document.createElement("p");
            matched.className = "matched-ingredients";
            matched.textContent =
                `使う食材：${result.matchedIngredients.join("・")}`
                + `（${result.matchedIngredients.length}/${ingredientNames.length}）`;
            item.appendChild(matched);
        }

        recipeList.appendChild(item);
    }
}

// 検索ボタン・Enterキーで検索する
searchForm.addEventListener("submit", event => {
    event.preventDefault();
    clearError();
    displaySearchResults();
});

// レシピ追加画面へ移動する
openAddButton.addEventListener("click", () => {
    if (recipeSearch === null) {
        return;
    }

    clearError();
    statusMessage.textContent = "";
    showAddScreen();
});

// 検索画面へ戻る
backButton.addEventListener("click", () => {
    clearError();
    statusMessage.textContent = "";
    showSearchScreen();
});

// 確定ボタンでレシピを追加する
addForm.addEventListener("submit", event => {
    event.preventDefault();

    if (recipeSearch === null) {
        return;
    }

    clearError();
    statusMessage.textContent = "";

    const recipeName = recipeNameInput.value.trim();
    const ingredientNames = ingredientNamesInput.value.trim();

    try {
        // 入力内容を確認し、未登録の組み合わせを準備する
        const newEntries = recipeSearch.prepareAddition(
            recipeName,
            ingredientNames
        );

        if (newEntries.length === 0) {
            statusMessage.textContent =
                "入力した食材と料理名の組み合わせは、すべて登録済みです。";
            return;
        }

        // 先にブラウザーへ保存する
        saveAdditions(newEntries);

        // 保存に成功したら検索用Mapへ反映する
        recipeSearch.applyAdditions(newEntries);

        // 入力欄を空にする
        addForm.reset();

        // 検索画面へ戻る
        showSearchScreen();

        // 検索欄に食材が入っていれば、結果も更新する
        if (searchInput.value.trim() !== "") {
            displaySearchResults();
        }

        statusMessage.textContent =
            `「${recipeName}」を${newEntries.length}種類の食材に追加し、`
            + "このブラウザーに保存しました。";

    } catch (error) {
        // 保存失敗時は入力内容を残す
        showError(error);
    }
});

// 起動時の読み込み処理
async function initialize() {
    clearError();
    statusMessage.textContent = "レシピデータを読み込んでいます。";

    searchInput.disabled = true;
    searchButton.disabled = true;
    openAddButton.disabled = true;

    let recipes;

    try {
        // CSVから基本データを読み込む
        recipes = await loadRecipes();
    } catch (error) {
        recipeSearch = null;
        statusMessage.textContent = "データを読み込めませんでした。";
        showError(error);
        return;
    }

    recipeSearch = new RecipeSearch(recipes);

    // 検索欄に入力候補をつなぐ（追加したレシピの材料も、Mapを通して候補に出る）
    setupIngredientSuggestions({
        input: searchInput,
        listbox: document.getElementById("search-suggestions"),
        liveRegion: document.getElementById("suggestions-status"),
        recipeSearch: recipeSearch
    });

    searchInput.disabled = false;
    searchButton.disabled = false;

    try {
        // ブラウザーに保存した追加データを読み込み、検索用Mapへ復元する
        const savedEntries = loadAdditions();
        recipeSearch.applyAdditions(savedEntries);
    } catch (error) {
        // 追加データが読めなくても、CSVのデータで検索は続けられるようにする
        // 壊れた保存データを上書きしないよう、追加ボタンは使えないままにする
        statusMessage.textContent =
            `読み込み完了：食材${recipes.size}種類`
            + "（追加したレシピは読み込めませんでした）";
        showError(
            error instanceof Error
                ? error.message
                    + "\n元のデータでの検索はできますが、"
                    + "レシピの追加はできません。"
                : String(error)
        );
        return;
    }

    openAddButton.disabled = false;

    statusMessage.textContent =
        `読み込み完了：食材${recipes.size}種類`;
}

initialize();
