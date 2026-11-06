import { loadRecipes } from "./recipeData.js";
import { RecipeSearch } from "./recipeSearch.js";
import { loadAdditions, saveAdditions } from "./recipeStorage.js";

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

    const ingredientName = searchInput.value.trim();

    // 前回の検索結果を消す
    recipeList.replaceChildren();

    if (ingredientName === "") {
        resultMessage.textContent = "食材を入力してください。";
        return;
    }

    const results = recipeSearch.searchRecipes(ingredientName);

    if (results.length === 0) {
        resultMessage.textContent =
            `「${ingredientName}」に該当する料理はありません。`;
        return;
    }

    resultMessage.textContent =
        `「${ingredientName}」を使う料理：${results.length}件`;

    for (const recipeName of results) {
        const item = document.createElement("li");

        // 入力された料理名は文字として表示する
        item.textContent = recipeName;
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

    try {
        // CSVから基本データを読み込む
        const recipes = await loadRecipes();

        // ブラウザーに保存した追加データを読み込む
        const savedEntries = loadAdditions();

        // 検索用オブジェクトを作り、追加データを復元する
        recipeSearch = new RecipeSearch(recipes);
        recipeSearch.applyAdditions(savedEntries);

        searchInput.disabled = false;
        searchButton.disabled = false;
        openAddButton.disabled = false;

        statusMessage.textContent =
            `読み込み完了：食材${recipes.size}種類`;

    } catch (error) {
        recipeSearch = null;
        statusMessage.textContent = "データを読み込めませんでした。";
        showError(error);
    }
}

initialize();