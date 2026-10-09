(() => {
  const root = document.querySelector('#quiz');
  const card = root.querySelector('.quiz-card');
  const body = root.querySelector('#quiz-stage');
  const progress = root.querySelector('#quiz-progress');
  const stepText = root.querySelector('#quiz-step-label');
  const percent = root.querySelector('#quiz-percent');
  const back = root.querySelector('#quiz-back');
  const reset = root.querySelector('#quiz-reset');
  const fields = {
    goal:'Цель', vehicle_choice:'Выбор автомобиля', deposit_status:'Первоначальный взнос',
    car_class:'Класс автомобиля', region:'Регион', rental_term:'Срок аренды',
    configuration:'Конфигурация', timing:'Когда планируете', age_group:'Возраст',
    driving_experience:'Водительский стаж', citizenship:'Гражданство'
  };
  const goalOptions = [
    ['Купить автомобиль под заказ','order','Первоначальный взнос от 20%'],
    ['Купить автомобиль из нашего автопарка','fleet'],
    ['Арендовать автомобиль для личных целей','personal'],
    ['Арендовать автомобиль для работы в такси','taxi']
  ];
  const regions = ['Тульская область','Рязанская область','Калужская область','Орловская область','Липецкая область'];
  const classes = ['Эконом','Комфорт','Пока не определился'];
  const configurations = ['МКПП + бензин','МКПП + газ','АКПП + бензин','АКПП + газ','Не имеет значения'];
  const purchaseTiming = ['В ближайшее время','В течение 1–3 месяцев','Позже','Пока изучаю варианты'];
  let answers = {}, current = 0, selectedCar = '', completed = false;
  const option = (label, note) => ({label,note});
  const schema = {
    goal: {title:'Для каких целей нужен автомобиль?', options:goalOptions.map(([label,value,note])=>({label,value,note}))},
    vehicle_choice:{title:'Уже определились с автомобилем?',options:['Да, знаю конкретный автомобиль','Знаю модель, но хочу сравнить варианты','Пока не определился — нужна рекомендация специалиста']},
    deposit_status:{title:'Как сейчас обстоят дела с первоначальным взносом?',options:['20% уже есть','Смогу внести, но нужно немного времени','Пока такой суммы нет','Сначала хочу узнать условия']},
    car_class:{title:'Какой класс автомобиля рассматриваете?',options:classes},
    region:{title:()=>answers.goal==='taxi'?'В каком регионе планируете работать?':'В каком регионе планируете ездить?',options:regions},
    rental_term:{title:'На какой срок нужен автомобиль?',options:()=>[answers.region==='Тульская область'?'10–30 дней':'15–30 дней','1–6 месяцев','Более 6 месяцев']},
    configuration:{title:'Какая конфигурация автомобиля предпочтительнее?',options:configurations},
    timing:{title:()=>answers.goal==='taxi'?'Когда планируете начать работу?':'Когда планируете приобрести автомобиль?',options:()=>answers.goal==='taxi'?['В ближайшие дни','В течение месяца','Через 1–3 месяца','Пока изучаю условия']:purchaseTiming},
    qualification_intro:{title:'Осталось уточнить несколько моментов',description:'Это поможет специалисту заранее понять ваши условия и подобрать подходящий вариант.'},
    age_group:{title:'Сколько вам лет?',options:['23 года и старше','Меньше 23 лет']},
    driving_experience:{title:'Какой у вас водительский стаж?',options:['3 года и более','Менее 3 лет']},
    citizenship:{title:'Какое у вас гражданство?',description:'Иностранных граждан рассматриваем индивидуально.',options:['Российское','Другое']},
    summary:{title:'Проверьте ваши ответы',description:'Ниже — информация, которую получит специалист. Если всё верно, продолжите и оставьте номер телефона.'},
    contact:{title:'Подберём подходящий вариант',description:'Вы ответили на основные вопросы — теперь специалист понимает вашу задачу и сможет точнее сориентировать вас по доступным автомобилям и условиям.'}
  };
  const route = () => {
    const common=['qualification_intro','age_group','driving_experience','citizenship','summary','contact'];
    const branch={order:['vehicle_choice','deposit_status','timing'],fleet:['car_class','timing'],personal:['region','rental_term','configuration'],taxi:['region','car_class','rental_term','configuration','timing']};
    return ['goal',...(branch[answers.goal]||[]),...common];
  };
  const track = (name, extra={}) => {
    if (Array.isArray(window.dataLayer)) window.dataLayer.push({event:name,...extra});
    root.dispatchEvent(new CustomEvent('autocar:'+name,{detail:extra}));
  };
  const el = (tag, className, value) => { const x=document.createElement(tag);if(className)x.className=className;if(value)x.textContent=value;return x; };
  const button = (text, className, fn) => {const x=el('button',className,text);x.type='button';x.addEventListener('click',fn);return x;};
  const info = text => body.append(el('p','quiz-v3-description',text));
  function render() {
    body.replaceChildren();
    const steps=route(), key=steps[current-1], def=schema[key];
    card.dataset.stage=key||'intro';
    back.hidden=current===0||completed;
    back.disabled=current===0;
    reset.hidden=false;
    if (completed) {
      stepText.textContent='Готово';percent.textContent='100%';progress.style.width='100%';
      body.append(el('h3','quiz-v3-title','Ваш подбор готов'));
      info('Ответы заполнены. Чтобы получить варианты автомобилей и точные условия, свяжитесь с Автокар71 по телефону или в MAX. В демонстрационной версии заявка автоматически не отправляется.');
      const contact=el('a','button quiz-v3-continue','Позвонить в Автокар71');contact.href='tel:+79539708877';body.append(contact);
      body.append(button('Вернуться на сайт','button quiz-v3-continue',()=>{location.href='/'}));
      return;
    }
    if(current===0){stepText.textContent='Подбор автомобиля';percent.textContent='';progress.style.width='0%';body.append(el('h3','quiz-v3-title','Подберём автомобиль под вашу задачу'));info('Ответьте на несколько вопросов — это займёт около минуты. В конце вы увидите сводку для специалиста.');body.append(button('Начать подбор','button quiz-v3-continue',()=>{current=1;render();track('quiz_start')}));return;}
    const title=typeof def.title==='function'?def.title():def.title;
    stepText.textContent=`Шаг ${current} из ${steps.length}`;
    const pct=Math.round(current/steps.length*100);percent.textContent=`${pct}%`;progress.style.width=`${pct}%`;
    body.append(el('h3','quiz-v3-title',title));
    if(def.description)info(def.description);
    track(key==='qualification_intro'?'quiz_qualification_view':key==='summary'?'quiz_summary_view':key==='contact'?'quiz_contact_view':'quiz_step_view',{step:key,position:current,total:steps.length});
    if(def.options){
      const options=el('div','quiz-v3-options');
      const list=typeof def.options==='function'?def.options():def.options;
      list.forEach(entry=>{
        const item=typeof entry==='string'?option(entry):entry;
        const choice=button(item.label,'quiz-v3-choice',()=>{
          const old=answers[key], value=item.value||item.label;
          if(key==='goal' && old!==value){answers={goal:value};if(value!=='fleet')selectedCar='';}
          else {answers[key]=value;if(key==='region'&&old!==value)delete answers.rental_term;}
          track('quiz_answer',{field:key,value:item.label});
          if(key==='goal')track('quiz_branch_selected',{goal:value});
          current++;render();
        });
        if(item.note)choice.append(el('small','',item.note));
        options.append(choice);
      });
      body.append(options);
    }else if(key==='qualification_intro'){
      info('Даже если вы не соответствуете одному из условий, заявку можно завершить. Менеджер рассмотрит ситуацию индивидуально.');
      body.append(button('Продолжить','button quiz-v3-continue',()=>{current++;render()}));
    }else if(key==='summary'){
      const list=el('dl','quiz-v3-summary');
      steps.filter(k=>fields[k]&&answers[k]).forEach(k=>{
        const row=el('div','quiz-v3-row');row.append(el('dt','',fields[k]),el('dd','',k==='goal'?goalOptions.find(o=>o[1]===answers[k])?.[0]:answers[k]));list.append(row);
      });
      if(selectedCar){const row=el('div','quiz-v3-row');row.append(el('dt','','Выбранный автомобиль'),el('dd','',selectedCar));list.append(row)}
      body.append(list,button('Всё верно — продолжить','button quiz-v3-continue',()=>{current++;render()}));
    }else if(key==='contact')renderContact();
  }
  const phoneDigits = value => {
    const digits=value.replace(/\D/g,'');
    if(digits.length===10)return '7'+digits;
    return digits.length===11 && digits[0]==='8'?'7'+digits.slice(1):digits;
  };
  const formatPhone = digits => '+7 ('+digits.slice(1,4)+') '+digits.slice(4,7)+'-'+digits.slice(7,9)+'-'+digits.slice(9,11);
  function renderContact(){
    const form=el('form','quiz-v3-form');form.noValidate=true;
    const label=el('label','','Ваш номер телефона');label.htmlFor='lead-phone';
    const phone=el('input');phone.id='lead-phone';phone.name='phone';phone.type='tel';phone.inputMode='tel';phone.autocomplete='tel';phone.placeholder='+7 (___) ___-__-__';phone.required=true;
    const error=el('p','quiz-v3-error');error.id='phone-error';error.setAttribute('role','alert');phone.setAttribute('aria-describedby','phone-error');
    const consent=el('label','quiz-v3-consent');
    const check=el('input');check.type='checkbox';check.required=true;
    const consentText=el('span');consentText.innerHTML='Даю <a href="/consent.html" target="_blank" rel="noopener">согласие на обработку персональных данных</a> для ответа на заявку. Ознакомлен(а) с <a href="/privacy.html" target="_blank" rel="noopener">Политикой</a>.';
    consent.append(check,consentText);
    const send=el('button','button quiz-v3-continue','Получить варианты');send.type='submit';
    form.append(label,phone,error,consent,send);
    form.append(el('p','quiz-v3-demo','Демонстрационная форма: данные не отправляются менеджеру. Для связи позвоните или напишите в MAX.'));
    // Keep typing/deleting untouched; format a complete number only when leaving the field.
    phone.addEventListener('input',()=>{error.textContent='';phone.removeAttribute('aria-invalid')});
    phone.addEventListener('blur',()=>{const digits=phoneDigits(phone.value);if(/^7\d{10}$/.test(digits))phone.value=formatPhone(digits)});
    form.addEventListener('submit',event=>{
      event.preventDefault();const digits=phoneDigits(phone.value);
      if(digits.length!==11||!/^7\d{10}$/.test(digits)){error.textContent='Введите номер полностью';phone.focus();return}
      if(!check.checked){error.textContent='Подтвердите согласие';check.focus();return}
      const params=new URLSearchParams(location.search);
      const payload={lead_source:'site',quiz_name:'Подбор автомобиля',goal:answers.goal,selected_car:selectedCar||undefined,vehicle_choice:answers.vehicle_choice,deposit_status:answers.deposit_status,car_class:answers.car_class,region:answers.region,rental_term:answers.rental_term,configuration:answers.configuration,timing:answers.timing,age_group:answers.age_group,driving_experience:answers.driving_experience,citizenship:answers.citizenship,phone:formatPhone(digits),page_url:location.href,utm:Object.fromEntries([...params].filter(([k])=>/^utm_/.test(k)))};
      // Prepared for a Tilda/CRM integration. The demonstration never stores or transmits personal data.
      track('quiz_submit',{goal:payload.goal,region:payload.region||'',rental_term:payload.rental_term||'',...payload.utm});
      completed=true;render();track('quiz_success',{goal:payload.goal});
    });
    body.append(form);
  }
  back.addEventListener('click',()=>{if(current>0){current--;render()}});
  reset.addEventListener('click',()=>{answers={};selectedCar='';current=0;completed=false;render()});
  window.autocarQuizStart=(purpose='',car='')=>{
    answers={};selectedCar=car;completed=false;
    current=0;
    render();track('quiz_view');
  };
  window.autocarQuizStart();
})();
