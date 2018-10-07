import View from "app/views/View";

class IncompatibleBrowserView extends View
{
	getHtml() {
		return `
			<div id="${this.uid}" class="incompatiblebrowser">
				К сожалению, Ваша версия браузера не поддерживается.<br/>
				Для открытия шахматки рекомендуется использовать последнюю версию браузеров Google Chrome, Mozilla Firefox или Microsoft Edge.
			</div>`;
	}
}

export default IncompatibleBrowserView;
