// 食材名として受け付ける形（全角カタカナと長音記号のみ）
// 検索と追加で同じ判定を使い、検索できない食材名が登録されないようにする
export function isKatakanaName(text) {
    return /^[ァ-ヶー]+$/.test(text);
}

export class RecipeSearch {

    constructor(recipes) {
        // CSVから作ったMapを保持する
        this.recipes = recipes;
    }

    // 食材名から料理名の一覧を取得する
    searchRecipes(ingredientName) {
        const key = ingredientName.trim();

        if (key === "") {
            return [];
        }

        const result = this.recipes.get(key);

        if (!result) {
            return [];
        }

        // 内部の配列が外部で変更されないよう、コピーを返す
        return [...result];
    }

    // 入力を確認し、新しく追加するデータを作る
    // この段階ではMapを変更しない
    prepareAddition(recipeName, ingredientNames) {
        const name = recipeName.trim();
        const ingredientsInput = ingredientNames.trim();

        if (name === "" || ingredientsInput === "") {
            throw new Error("料理名と材料名を入力してください。");
        }

        if (/[,\r\n]/.test(name)) {
            throw new Error(
                "料理名には半角カンマや改行を入れないでください。"
            );
        }

        if (/[\r\n]/.test(ingredientsInput)) {
            throw new Error(
                "材料は改行せず、半角カンマで区切ってください。"
            );
        }

        // 半角カンマで分割し、前後の空白と空の要素を除く
        const ingredients = ingredientsInput
            .split(",")
            .map(ingredient => ingredient.trim())
            .filter(ingredient => ingredient !== "");

        if (ingredients.length === 0) {
            throw new Error("材料名を1つ以上入力してください。");
        }

        // 検索欄は全角カタカナしか受け付けないため、追加時も同じ形に限る
        for (const ingredient of ingredients) {
            if (isKatakanaName(ingredient)) {
                continue;
            }

            if (/[、，]/.test(ingredient)) {
                throw new Error(
                    "材料は「、」ではなく半角カンマ「,」で区切ってください。"
                );
            }

            throw new Error(
                `材料名「${ingredient}」は全角カタカナで入力してください。`
            );
        }

        // Setを使い、入力内で重複した材料名を取り除く
        const uniqueIngredients = new Set(ingredients);

        const entries = [];

        for (const ingredientName of uniqueIngredients) {
            const recipeNames = this.recipes.get(ingredientName);

            // すでに登録されている組み合わせは追加しない
            if (recipeNames && recipeNames.includes(name)) {
                continue;
            }

            entries.push({
                ingredientName: ingredientName,
                recipeName: name
            });
        }

        return entries;
    }

    // データを検索用Mapに反映する
    // 起動時の保存データ復元にも使用する
    applyAdditions(entries) {
        for (const entry of entries) {
            const ingredientName = entry.ingredientName;
            const recipeName = entry.recipeName;

            if (!this.recipes.has(ingredientName)) {
                this.recipes.set(ingredientName, []);
            }

            const recipeNames = this.recipes.get(ingredientName);

            if (!recipeNames.includes(recipeName)) {
                recipeNames.push(recipeName);
            }
        }
    }
}