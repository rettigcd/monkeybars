import { YEARS } from "~/lib/units";
import { ImageModel } from "../models/image-model";

class Colors {

	forMonth: string[];
	old!: string;
	attribute!: string;
	galleryRowBg!: string;
	video: string = 'purple';

	constructor({winter,spring,summer,fall,old,attribute,galleryRowBg}
		:Record<"winter"|"spring"|"summer"|"fall"|"old"|"attribute"|"galleryRowBg",string>){
		Object.assign(this,{attribute,galleryRowBg,old});
		this.forMonth = [winter,winter,spring,spring,spring,summer,summer,summer,fall,fall,fall,winter];
	}
}

// light
// const colors = new Colors({
// 	winter:'#ddf', spring:'#9ab895', summer:'#d48e8e', fall:'#b3a174', old:'white',
// 	attribute:'black', galleryRowBg:'white'
// });

// dark
const colors = new Colors({
	winter:'#668', spring:'#373', summer:'#844', fall:'#663', old:'#444',
	attribute:'white', galleryRowBg:'#333'
});

export const css = {
	spinner: { border:"8px solid", "border-color":"blue lightgray", 'border-radius':'50%', width:'16px',height:'16px', animation:'spin 2s linear infinite' },
	imageRow: { "display":"flex","flex-direction":"row","justify-content":"flex-start", background:colors.galleryRowBg},
	monthName: (idx:number) => ({color:colors.attribute,'background':colors.forMonth[idx]}),
};

// Image Thumbnail cards/controls
export const boxSize = 250;

export const imgCardCss = { 
	containerCss: { width:boxSize+'px',	display:'inline-block', textAlign:'center', margin:'5px', position:'relative' },
	imageSizeSpanCss: { fontSize:'10px', fontWeight:'bold', marginRight:'5px', color:colors.attribute },
	imgCss: { maxWidth: `${boxSize}px`, maxHeight: `${boxSize}px` },
	dateSpanCss: {color:colors.attribute},
	checkmarkCss: {position:'absolute',top:'0',right:'10px',display:'inline-block','backgroundColor':'white',border:'thin solid black',padding:'3px'},
};

export function imgCardBgColor(model:ImageModel) {
	if(model.videoUrl) return colors.video;
	if(1 * YEARS < model.ageMs) return colors.old;
	return colors.forMonth[model.imgDate.getMonth()];
}
