import {
    splitIngredientNames,
    splitLastIngredient,
    toKatakana
} from "./recipeSearch.js";

// 一度に出す候補の数（スマホでキーボードに隠れにくい数にする）
const MAX_SUGGESTIONS = 6;

// 候補を上に出すとき、画面からはみ出す分を減らしても残す最低の件数
const MIN_SUGGESTIONS_ABOVE = 3;

// パソコン（マウス操作）の画面か。CSSの同じ条件で、候補を上に出す見た目にしている
const prefersAbove = window.matchMedia("(hover: hover) and (pointer: fine)");

// 検索欄に入力候補をつなぐ
// input：検索欄、listbox：候補を入れる ul、liveRegion：読み上げ用の領域
// recipeSearch：RecipeSearch（読み込み後のもの）
export function setupIngredientSuggestions({
    input,
    listbox,
    liveRegion,
    recipeSearch
}) {
    // 今出している候補と、↑↓で選んでいる候補の番号（-1 は未選択）
    let suggestions = [];
    let activeIndex = -1;

    // IMEで変換中（未確定の文字がある）か
    let composing = false;

    // 今表示している候補の中身（同じなら一覧を作り直さないため）
    let shownKey = "";

    // 指やマウスで押した候補（押してから離すまでに一覧が変わっても選べるようにする）
    let pressedSuggestion = null;

    // 候補の中身を比べるための文字列にする
    function suggestionKey(list) {
        return list
            .map(suggestion =>
                `${suggestion.ingredientName}:${suggestion.recipeCount}`
            )
            .join(",");
    }

    // 候補の id を作る（aria-activedescendant で指すため）
    function optionId(index) {
        return `${listbox.id}-option-${index}`;
    }

    // 読み上げ用の文を更新する（同じ件数なら変えず、1文字ごとに読み上げないようにする）
    function announce(count) {
        const text = count === 0
            ? ""
            : `候補が${count}件あります。上下キーで選べます。`;

        if (liveRegion.textContent !== text) {
            liveRegion.textContent = text;
        }
    }

    // 候補を閉じる
    function close() {
        suggestions = [];
        shownKey = "";
        activeIndex = -1;

        listbox.replaceChildren();
        listbox.hidden = true;

        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");

        announce(0);
    }

    // 選んでいる候補の見た目と ARIA 属性をそろえる
    function updateActive() {
        const options = listbox.querySelectorAll("[role='option']");

        options.forEach((option, index) => {
            option.setAttribute(
                "aria-selected",
                index === activeIndex ? "true" : "false"
            );
        });

        if (activeIndex === -1) {
            input.removeAttribute("aria-activedescendant");
        } else {
            input.setAttribute("aria-activedescendant", optionId(activeIndex));
        }
    }

    // 入力内容から候補を作り直して表示する
    function update() {
        const { before, last } = splitLastIngredient(input.value);

        // すでに入れた食材は候補に出さない（ひらがなで入れた分もカタカナで比べる）
        const entered = splitIngredientNames(before).map(toKatakana);

        const nextSuggestions = recipeSearch.suggestIngredients(
            last,
            entered,
            MAX_SUGGESTIONS
        );

        // 候補が前と同じなら作り直さない
        // スマホでは、変換中に候補をタップすると指が触れた瞬間に変換が確定して input が起きる。
        // ここで一覧を作り直すと、指を離したときには別の要素に置きかわっていて click が起きない
        const nextKey = suggestionKey(nextSuggestions);

        if (!listbox.hidden && nextKey === shownKey) {
            return;
        }

        suggestions = nextSuggestions;
        shownKey = nextKey;
        activeIndex = -1;

        if (suggestions.length === 0) {
            close();
            return;
        }

        const items = suggestions.map((suggestion, index) => {
            const item = document.createElement("li");
            item.id = optionId(index);
            item.dataset.index = String(index);
            item.setAttribute("role", "option");
            item.setAttribute("aria-selected", "false");

            const name = document.createElement("span");
            name.className = "suggestion-name";
            name.textContent = suggestion.ingredientName;

            const count = document.createElement("span");
            count.className = "suggestion-count";
            count.textContent = `料理${suggestion.recipeCount}件`;

            item.append(name, count);

            return item;
        });

        listbox.replaceChildren(...items);
        listbox.hidden = false;
        placeListbox();

        input.setAttribute("aria-expanded", "true");
        input.removeAttribute("aria-activedescendant");

        announce(suggestions.length);
    }

    // 候補を出す位置を決める
    // パソコンでは、IMEの予測変換の窓（入力位置のすぐ下に出る）と重ならないよう上に出す
    // 上が狭くて画面からはみ出すときは候補を減らし、3件も入らなければ下に出す
    function placeListbox() {
        listbox.classList.remove("is-above");

        if (!prefersAbove.matches) {
            return;
        }

        listbox.classList.add("is-above");

        // 下に出し直すときに全部の候補へ戻せるよう、減らす前を覚えておく
        const allSuggestions = [...suggestions];
        const allItems = [...listbox.children];

        while (
            listbox.getBoundingClientRect().top < 0
            && suggestions.length > MIN_SUGGESTIONS_ABOVE
        ) {
            suggestions.pop();
            listbox.lastElementChild.remove();
        }

        if (listbox.getBoundingClientRect().top < 0) {
            suggestions = allSuggestions;
            listbox.replaceChildren(...allItems);
            listbox.classList.remove("is-above");
        }
    }

    // 候補を選び、最後の食材だけを置きかえる
    // suggestion：選んだ候補（{ ingredientName, recipeCount }）
    function choose(suggestion) {
        if (!suggestion) {
            return;
        }

        // IMEで変換中（未確定）のまま値を書きかえると、スマホのIMEが
        // 変換中だった文字（例：「はむ」）を後から入れ直し、選んだ食材名が消えてしまう
        // 先にフォーカスを外して変換を確定させてから書きかえ、あとでフォーカスを戻す
        if (composing) {
            input.blur();
        }

        const { before } = splitLastIngredient(input.value);
        input.value = before + suggestion.ingredientName;

        close();

        // カーソルは検索欄の最後に置く（続けて区切りと次の食材を打てるように）
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }

    // 打つたびに候補を更新する（IMEで変換中の文字にも反応する）
    input.addEventListener("input", update);

    // IMEで変換中かどうかを覚えておく（候補を選ぶときに使う）
    input.addEventListener("compositionstart", () => {
        composing = true;
    });

    input.addEventListener("compositionend", () => {
        composing = false;
    });

    input.addEventListener("keydown", event => {
        // IMEで変換中のキーは IME の操作なので、候補では使わない
        if (event.isComposing || event.keyCode === 229) {
            return;
        }

        if (listbox.hidden) {
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            activeIndex = (activeIndex + 1) % suggestions.length;
            updateActive();
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            activeIndex = activeIndex <= 0
                ? suggestions.length - 1
                : activeIndex - 1;
            updateActive();
        } else if (event.key === "Enter" && activeIndex !== -1) {
            // 候補を選んでいるときだけ、検索ではなく候補を選ぶ
            event.preventDefault();
            choose(suggestions[activeIndex]);
        } else if (event.key === "Escape") {
            event.preventDefault();
            close();
        }
    });

    // 検索欄から離れたら閉じる
    // フォーカスが外れると変換は確定するので、compositionend が来ない場合に備えて変換中の印も消す
    input.addEventListener("blur", () => {
        composing = false;
        close();
    });

    // 候補を押した瞬間に検索欄のフォーカスが外れると、クリックが効かなくなるので防ぐ
    // 押した候補もここで覚えておく
    listbox.addEventListener("pointerdown", event => {
        event.preventDefault();

        const option = event.target.closest("[role='option']");
        pressedSuggestion = option
            ? suggestions[Number(option.dataset.index)] ?? null
            : null;
    });

    // タップ・クリックで選ぶ
    // 押してから離すまでに一覧が作り直されると、click は候補ではなく一覧（ul）で起きる。
    // そのときは押したときに覚えた候補を使う
    listbox.addEventListener("click", event => {
        const option = event.target.closest("[role='option']");
        const suggestion = option
            ? suggestions[Number(option.dataset.index)]
            : pressedSuggestion;

        pressedSuggestion = null;
        choose(suggestion);
    });

    // 検索したら候補を閉じる
    if (input.form) {
        input.form.addEventListener("submit", close);
    }

    close();
}
