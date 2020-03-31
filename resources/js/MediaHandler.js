export default class MediaHandler{

	getPremission(){
		return new Promise((resolve, reject) => {
			navigator.mediaDevices.getUserMedia({ video: true, audio: true})
				.then((stream) => {
					resolve(stream);
				}).catch((error) => {
					throw new Error("This app need premission to work");
				});
		});
	}
}