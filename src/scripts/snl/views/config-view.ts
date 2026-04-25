import { $, ElementBuilder } from "~/utils/dom3";
import { bind } from "../bind";
import { ConfigService } from "../config";
import { css } from "./css";

export function configView( configService:ConfigService ) : HTMLElement{
	const model = configService.model;

	function $input(type='text') : ElementBuilder<HTMLInputElement> { return $('input').attr('type',type); }

	return $('p').css(css.subBar).css({background:"#aaf"}).txt('Config: ').withChildren(
		$('select').do(x=>bind.optionsToStringArr(x,model,'configOptions')).do(x=>bind.selectValue(x,model,'configName')),
		// Service
		$('button').txt('➕').on('click',()=>configService.addUser()),
		$('button').txt('➖').on('click',()=>configService.removeName()),
		// Model
		$input().css(css.input).attr('placeholder','first').do(x=>bind.textInput(x,model,'firstName')),
		$input().css(css.input).attr('placeholder','last').do(x=>bind.textInput(x,model,'lastName')),
		$input().css(css.input).attr('placeholder','phone').do(x=>bind.textInput(x,model,'phone')),
		$input().css(css.email).attr('placeholder','email').do(x=>bind.textInput(x,model,'email')),
		$input().css({width:"50px"}).attr('placeholder','1-4').do(x=>bind.textInput(x,model,'groupSize')),
		$('select').do( x=>x.replaceChildren(...configService.showOptions.map(x=>new Option(x,x))) ).do(x=>bind.selectShowValue(x,model,'show')),
		$input().css(css.input50).attr('placeholder','msDelay').do(x=>bind.textInput(x,model,'msDelay')),
		$input('checkbox').css({height:"18px",width:"18px",verticalAlign:'top'}).do(x=>bind.checkbox(x,model,'isDefault')),
		// Service
		$('button').txt('💾').on('click',()=>configService.saveUser())
	).el;
}
