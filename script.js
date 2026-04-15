
var current = 1; var totalSteps = 5;
var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbys0xiX_ZJDLN0hV-WhH6vVH0vKuoHKkPihD473KlENBIxn9AiZqtu_ndcmB1sdAfh8gQ/exec';
var fileUploadPromises = {};

function showStep(n) {
  document.querySelectorAll('.step').forEach(function(s){s.classList.remove('active');});
  var t = n==='success' ? document.getElementById('stepSuccess') : document.getElementById('step'+n);
  t.classList.add('active');
  var pct = n==='success' ? 100 : (n/totalSteps)*100;
  document.getElementById('progressFill').style.width = pct+'%';
  var lbl = document.getElementById('progressLabel');
  if(lbl) lbl.textContent = n==='success' ? 'Complete!' : 'Step '+n+' of '+totalSteps;
  // Update dots
  document.querySelectorAll('.dot').forEach(function(d,i){
    d.classList.remove('active','done');
    if(n==='success'){ d.classList.add('done'); }
    else if(i+1 === n){ d.classList.add('active'); }
    else if(i+1 < n){ d.classList.add('done'); }
  });
  window.scrollTo({top:0,behavior:'smooth'});
}

function scrollToFirstError() {
  var first = document.querySelector('.step.active .err-msg');
  if(first){ first.scrollIntoView({behavior:'smooth',block:'center'}); }
}

function updateCharCount(el, countId, minWords, maxWords) {
  var words = el.value.trim() === '' ? 0 : el.value.trim().split(/\s+/).length;
  var el2 = document.getElementById(countId);
  if(!el2) return;
  el2.textContent = words + ' word' + (words===1?'':'s');
  el2.className = 'char-count';
  if(maxWords > 0 && words > maxWords) el2.classList.add('over');
  else if(minWords > 0 && words < minWords && words > 0) el2.classList.add('warn');
}
function getVal(id) { var el=document.getElementById(id); return el?el.value.trim():''; }
function setErr(id, msg) {
  var el=document.getElementById(id); if(!el) return;
  el.style.borderColor='#e03030'; el.style.background='#fff5f5';
  var wrap=el.closest('.field');
  if(wrap&&!wrap.querySelector('.err-msg')){var e=document.createElement('span');e.className='err-msg';e.textContent=msg;wrap.appendChild(e);}
}
function clearErr(id) {
  var el=document.getElementById(id); if(!el) return;
  el.style.borderColor=''; el.style.background='';
  var wrap=el.closest('.field'); var e=wrap&&wrap.querySelector('.err-msg'); if(e) e.remove();
}
function validate(checks) {
  var ok=true;
  checks.forEach(function(c){
    var el=document.getElementById(c.id); if(!el) return;
    var val = el.value ? el.value.trim() : '';
    if(!val){ setErr(c.id,c.msg); ok=false; } else { clearErr(c.id); }
  });
  return ok;
}
function clearPillErr(gridId) {
  var grid = document.getElementById(gridId); if(!grid) return;
  grid.style.outline = ''; grid.style.borderRadius = '';
  var wrap = grid.closest('.field');
  var e = wrap && wrap.querySelector('.err-msg'); if(e) e.remove();
}
function getPillValues(gridId) {
  return Array.from(document.querySelectorAll('#'+gridId+' input:checked')).map(function(i){return i.value;}).join(', ');
}

function parseJsonResponse(response) {
  if (response.type === 'opaque') {
    console.warn('[SWYN] opaque response received from no-cors request; assuming success');
    return Promise.resolve({ success: true, url: '' });
  }
  return response.text().then(function(text) {
    if (!response.ok) {
      throw new Error('Server returned status ' + response.status + ': ' + text);
    }
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error('Invalid JSON response: ' + text);
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {

  // Initialise drag-and-drop on all drop zones
  initDropZones();

  // Global Enter key → move to next field or advance step
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' && e.keyCode !== 13) return;
    var active = document.activeElement;
    var tag = active ? active.tagName : '';
    var id  = active ? active.id : '';
    var skipIds = ['notableCompanyInput', 'pastClientInput', 'expertiseOther'];
    if (tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (skipIds.indexOf(id) !== -1) return;
    e.preventDefault();
    e.stopPropagation();

    // Field order: Enter moves to next field
    var fieldOrder = ['firstName','lastName','primaryEmail','phoneNumber','headline',
                      'jobTitle','currentCompany',
                      'linkedinProfile','websiteUrl','articleUrl',
                      'topAchievements','additionalInfo'];
    var stepLast = {'headline':'next1','currentCompany':'next2','articleUrl':'next4','additionalInfo':'btnSubmit'};
    var idx = fieldOrder.indexOf(id);

    if (idx !== -1 && idx < fieldOrder.length - 1 && !stepLast[id]) {
      // Move focus to next field
      var nextField = document.getElementById(fieldOrder[idx + 1]);
      if (nextField) { nextField.focus(); return; }
    }
    if (stepLast[id]) {
      // Last field in step — click Next
      var btn = document.getElementById(stepLast[id]);
      if (btn) { btn.click(); return; }
    }

    // Fallback: advance current step
    var nextIds = ['next1', 'next2', 'next3', 'next4', 'btnSubmit'];
    var btn = document.getElementById(nextIds[current - 1]);
    if (btn) btn.click();
  });

  // Auto-clear errors + live validation feedback
  document.querySelectorAll('input,select,textarea').forEach(function(el) {
    ['input','change'].forEach(function(evt){
      el.addEventListener(evt, function(){
        el.style.borderColor = ''; el.style.background = '';
        el.style.boxShadow = '';
        var wrap = el.closest('.field');
        var e = wrap && wrap.querySelector('.err-msg'); if(e) e.remove();
      });
    });
    // Show green border when field has valid content and loses focus
    el.addEventListener('blur', function(){
      if(el.type === 'hidden' || el.tagName === 'SELECT') return;
      var fieldWrap = el.closest('.field');
      if(el.value && el.value.trim() && !(fieldWrap && fieldWrap.querySelector('.err-msg'))){
        el.style.borderColor = '#7cb87f';
      }
    });
    el.addEventListener('focus', function(){
      el.style.borderColor = '';
    });
  });

  // Live email format hint
  var emailEl = document.getElementById('primaryEmail');
  if(emailEl){
    emailEl.addEventListener('blur', function(){
      if(emailEl.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())){
        setErr('primaryEmail','Please enter a valid email address.');
      }
    });
  }

  // Pill radio/checkbox toggle
  document.querySelectorAll('.pill input').forEach(function(inp) {
    inp.addEventListener('change', function() {
      if (inp.type === 'radio') {
        var name = inp.name;
        document.querySelectorAll('.pill input[name="'+name+'"]').forEach(function(r){ r.closest('.pill').classList.remove('selected'); });
        inp.closest('.pill').classList.add('selected');
        // store in hidden
        if (name==='simultaneous') document.getElementById('simultaneousEngagements').value = inp.value;
        if (name==='websiteListing') { document.getElementById('websiteListingConsent').value = inp.value; clearPillErr('websiteListingGrid'); }
      } else {
        inp.closest('.pill').classList.toggle('selected', inp.checked);
        var gridId = inp.closest('.pill-grid') && inp.closest('.pill-grid').id;
        if (gridId === 'engagementTypeGrid') {
          document.getElementById('engagementTypes').value = getPillValues('engagementTypeGrid');
        }
        if (gridId === 'workModeGrid') {
          document.getElementById('workMode').value = getPillValues('workModeGrid');
        }
        if (gridId === 'travelGrid') {
          document.getElementById('willingToTravel').value = getPillValues('travelGrid');
        }
        if (gridId) clearPillErr(gridId);
      }
    });
  });

  // STEP 1
  document.getElementById('next1').addEventListener('click', function() {
    var checks = [
      {id:'firstName',msg:'Please enter your first name.'},
      {id:'lastName',msg:'Please enter your last name.'},
      {id:'primaryEmail',msg:'Please enter your personal email.'},
      {id:'phoneNumber',msg:'Please enter your mobile number.'},
      {id:'city',msg:'Please select your city.'},
      {id:'headline',msg:'Please enter your professional headline.'},
    ];
    if (getVal('city')==='Other') checks.push({id:'cityOther',msg:'Please specify your city.'});
    var ok = validate(checks);
    // Phone format check
    var phone = document.getElementById('phoneNumber');
    var digits = phone.value.replace(/\D/g,'');
    if (phone.value && (digits.length < 7 || digits.length > 15)) {
      setErr('phoneNumber','Enter a valid phone number (7–15 digits with country code).');
      ok = false;
    }
    // Email format check
    var email = document.getElementById('primaryEmail');
    if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      setErr('primaryEmail','Please enter a valid email address.');
      ok = false;
    }
    if (ok) { current=2; showStep(current); } else { scrollToFirstError(); }
  });

  // STEP 2
  document.getElementById('back2').addEventListener('click', function(){ current=1; showStep(current); });
  document.getElementById('next2').addEventListener('click', function() {
    var checks = [
      {id:'jobTitle',msg:'Please enter your current job title.'},
      {id:'yearsExperience',msg:'Please select your years of experience.'},
      {id:'primaryIndustry',msg:'Please select your primary industry.'},
      {id:'biography',msg:'Please provide a professional biography.'},
    ];
    if (getVal('primaryIndustry')==='Other') checks.push({id:'industryOther',msg:'Please specify your industry.'});
    var ok = validate(checks);
    // Sector check
    if (!getPillValues('sectorGrid')) {
      var sg = document.getElementById('sectorGrid');
      sg.style.outline = '2px solid #e03030'; sg.style.borderRadius = '8px';
      var wrap = sg.closest('.field');
      if (!wrap.querySelector('.err-msg')) { var e=document.createElement('span');e.className='err-msg';e.style.display='block';e.textContent='Please select at least one key sector.';wrap.appendChild(e); }
      ok = false;
    } else { clearPillErr('sectorGrid'); }
    // Expertise check
    if (!getVal('areasOfExpertiseHidden')) {
      var ef = document.getElementById('areasOfExpertise');
      ef.style.borderColor = '#e03030';
      var wrap2 = ef.closest('.field');
      if (!wrap2.querySelector('.err-msg')) { var e2=document.createElement('span');e2.className='err-msg';e2.textContent='Please select at least one area of expertise.';wrap2.appendChild(e2); }
      ok = false;
    } else { clearErr('areasOfExpertise'); }
    // Engagement types — re-sync hidden field first
    var engVal = getPillValues('engagementTypeGrid');
    document.getElementById('engagementTypes').value = engVal;
    if (!engVal) {
      var eg = document.getElementById('engagementTypeGrid');
      eg.style.outline = '2px solid #e03030'; eg.style.borderRadius = '8px';
      var wrapEg = eg.closest('.field');
      if (!wrapEg.querySelector('.err-msg')) { var eEg=document.createElement('span');eEg.className='err-msg';eEg.style.display='block';eEg.textContent='Please select at least one engagement type.';wrapEg.appendChild(eEg); }
      ok = false;
    } else { clearPillErr('engagementTypeGrid'); }
    if (ok) { current=3; showStep(current); } else { scrollToFirstError(); }
  });

  // STEP 3
  document.getElementById('back3').addEventListener('click', function(){ current=2; showStep(current); });
  document.getElementById('next3').addEventListener('click', function() {
    var checks = [
      {id:'hourlyRate',msg:'Please select your preferred hourly rate (USD).'},
      {id:'hourlyRateINR',msg:'Please select your preferred hourly rate (INR).'},
      {id:'hoursPerMonth',msg:'Please select hours per month.'},
      {id:'requireNDA',msg:'Please select your NDA preference.'},
      {id:'mentoringExperience',msg:'Please select your mentoring experience.'},
      {id:'formalMentor',msg:'Please select an option.'},
    ];
    var ok = validate(checks);
    // Startup stage check
    if (!getPillValues('startupStageGrid')) {
      var sg = document.getElementById('startupStageGrid');
      sg.style.outline = '2px solid #e03030'; sg.style.borderRadius = '8px';
      var wrap = sg.closest('.field');
      if (!wrap.querySelector('.err-msg')) { var e=document.createElement('span');e.className='err-msg';e.style.display='block';e.textContent='Please select at least one startup stage.';wrap.appendChild(e); }
      ok = false;
    } else { clearPillErr('startupStageGrid'); }
    if (ok) { current=4; showStep(current); } else { scrollToFirstError(); }
  });

  // STEP 4
  document.getElementById('back4').addEventListener('click', function(){ current=3; showStep(current); });
  document.getElementById('next4').addEventListener('click', function() {
    var checks = [{id:'linkedinProfile',msg:'Please enter your LinkedIn profile URL.'}];
    var ok = validate(checks);
    // CV upload check — verify a file has actually been selected
    var cvInput = document.getElementById('cvFile');
    var cvZone = document.getElementById('cvZone');
    var cvField = cvZone ? cvZone.closest('.field') : null;
    var cvHasFile = cvInput && cvInput.files && cvInput.files.length > 0;
    if (!cvHasFile) {
      if (cvZone) { cvZone.style.borderColor = '#c0392b'; cvZone.style.background = '#fff5f5'; }
      if (cvField && !cvField.querySelector('.err-msg')) {
        var cvErr = document.createElement('span');
        cvErr.className = 'err-msg'; cvErr.textContent = 'Please upload your CV or Resume.';
        cvField.appendChild(cvErr);
      }
      ok = false;
    } else {
      if (cvZone) { cvZone.style.borderColor = ''; cvZone.style.background = ''; }
      if (cvField) { var e = cvField.querySelector('.err-msg'); if(e) e.remove(); }
    }
    if (ok) { current=5; showStep(current); } else { scrollToFirstError(); }
  });

  // STEP 5
  document.getElementById('back5').addEventListener('click', function(){ current=4; showStep(current); });
  document.getElementById('btnSubmit').addEventListener('click', function() {
    var checks = [
      {id:'topAchievements', msg:'Please share your top achievements.'},
    ];
    var ok = validate(checks);
    // Website listing consent — radio pill, read directly
    var listingChecked = document.querySelector('#websiteListingGrid input:checked');
    var listingVal = listingChecked ? listingChecked.value : '';
    document.getElementById('websiteListingConsent').value = listingVal;
    if (!listingVal) {
      var wlGrid = document.getElementById('websiteListingGrid');
      wlGrid.style.outline = '2px solid #e03030'; wlGrid.style.borderRadius = '8px';
      var wlWrap = wlGrid.closest('.field');
      if (!wlWrap.querySelector('.err-msg')) { var wlE=document.createElement('span');wlE.className='err-msg';wlE.style.display='block';wlE.textContent='Please select your website listing preference.';wlWrap.appendChild(wlE); }
      ok = false;
    } else { clearPillErr('websiteListingGrid'); }
    var termsOk = document.getElementById('termsCheck').checked;
    if (!termsOk) {
      var tb = document.getElementById('termsCheck').closest('.terms-box');
      tb.style.borderColor = '#e03030';
      if (!document.getElementById('termsErrMsg')) {
        var err=document.createElement('span');err.className='err-msg';err.id='termsErrMsg';err.style.display='block';err.style.marginTop='6px';
        err.textContent='Please confirm and agree to continue.'; tb.parentElement.appendChild(err);
      }
    } else {
      var tb2 = document.getElementById('termsCheck').closest('.terms-box');
      if(tb2) tb2.style.borderColor='';
      var te=document.getElementById('termsErrMsg'); if(te) te.remove();
    }
    if (!ok || !termsOk) { scrollToFirstError(); return; }

    var uploadZones = [
      {inputId:'cvFile', zoneId:'cvZone', listId:'cvFileList', hiddenId:'cvDriveUrl'},
      {inputId:'photoFile', zoneId:'photoZone', listId:'photoFileList', hiddenId:'photoDriveUrl'},
      {inputId:'samplesFile', zoneId:'samplesZone', listId:'samplesFileList', hiddenId:'workSamplesDriveUrl'}
    ];
    var pendingUploads = uploadZones.map(function(zone) {
      var input = document.getElementById(zone.inputId);
      if (!input || !input.files || !input.files.length) return Promise.resolve([]);
      return fileUploadPromises[zone.zoneId] || handleDropFiles(input, zone.zoneId, zone.listId, zone.hiddenId);
    });
    Promise.all(pendingUploads).then(function(uploadResults) {
      console.log('[SWYN] file upload results before submit:', uploadResults);
      var failedZone = uploadZones.some(function(zone, idx) {
        var input = document.getElementById(zone.inputId);
        return input && input.files && input.files.length && (!uploadResults[idx] || !uploadResults[idx].length);
      });
      if (failedZone) {
        var btn = document.getElementById('btnSubmit');
        btn.textContent = 'Submit Application →';
        btn.disabled = false;
        btn.classList.remove('loading');
        alert('One or more files could not be uploaded. Please try again.');
        return;
      }

      var data = {
        'Full Name': getVal('firstName')+' '+getVal('lastName'),
      'Primary Email Address': getVal('primaryEmail'),
      'Phone Number (including country code)': getVal('phoneNumber'),
      'City': getVal('city')==='Other'?getVal('cityOther'):getVal('city'),
      'Current professional headline': getVal('headline'),
      'Gender': getVal('gender'),
      'How did you hear about SWYN?': getVal('heardAbout')==='Other'?getVal('heardAboutOther'):getVal('heardAbout'),
      'Current Job Title/Role': getVal('jobTitle'),
      'Current Company/Organization': getVal('currentCompany'),
      'Total Years of Professional Experience': getVal('yearsExperience'),
      'Primary Industry of Expertise': getVal('primaryIndustry')==='Other'?getVal('industryOther'):getVal('primaryIndustry'),
      'Please provide a brief biography/professional summary': getVal('biography'),
      'Key sectors / industries': getPillValues('sectorGrid'),
      'Type of companies you have worked with': getPillValues('companyTypeGrid'),
      'Notable companies worked for': getVal('notableCompaniesHidden'),
      'Types of engagements open to': getVal('engagementTypes'),
      'Past clients or companies advised': getVal('pastClientsHidden'),
      'Specific Areas of Expertise for Mentorship': getVal('areasOfExpertiseHidden'),
      'Preferred hourly rate card (In USD)': getVal('hourlyRate'),
      'Preferred hourly rate card (In INR)': getVal('hourlyRateINR'),
      "If 'Negotiable' (USD), please specify details:": getVal('rateNegotiable'),
      "If 'Negotiable' (INR), please specify details:": getVal('rateNegotiableINR'),
      'Hours per month for mentoring startup founders': getVal('hoursPerMonth'),
      'Number of simultaneous engagements': getVal('simultaneousEngagements'),
      'Work mode preference': getVal('workMode'),
      'Willingness to travel for events/meetups': getVal('willingToTravel'),
      'Client types most comfortable with': getPillValues('clientTypeGrid'),
      'What kind of mandates excite you most?': getPillValues('mandateGrid'),
      'Do you require an NDA or formal agreement?': getVal('requireNDA'),
      'Experience level in mentoring early-stage startups': getVal('mentoringExperience'),
      'Previously served as a formal mentor/advisor/board member?': getVal('formalMentor'),
      'Equipped to mentor stage of startup development': getPillValues('startupStageGrid'),
      'Link to your LinkedIn Profile': getVal('linkedinProfile'),
      'Personal website / portfolio': getVal('websiteUrl'),
      'Any published articles or media mentions': getVal('articleUrl'),
      'Top Achievements': getVal('topAchievements'),
      'Consent to list on swyn.in': getVal('websiteListingConsent'),
      'Anything else you would like SWYN to know?': getVal('additionalInfo'),
      'CV / Resume (file name)': (function(){ var i=document.getElementById('cvFile'); return i&&i.files&&i.files.length?Array.from(i.files).map(function(f){return f.name;}).join(', '):''; })(),
      'CV / Resume (drive URL)': getVal('cvDriveUrl'),
      'Professional Photo (file name)': (function(){ var i=document.getElementById('photoFile'); return i&&i.files&&i.files.length?Array.from(i.files).map(function(f){return f.name;}).join(', '):''; })(),
      'Professional Photo (drive URL)': getVal('photoDriveUrl'),
      'Work Samples (file names)': (function(){ var i=document.getElementById('samplesFile'); return i&&i.files&&i.files.length?Array.from(i.files).map(function(f){return f.name;}).join(', '):''; })(),
      'Work Samples (drive URLs)': getVal('workSamplesDriveUrl'),
      'Submitted At': new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})
    };

    var btn = document.getElementById('btnSubmit');
    btn.textContent = '⏳ Submitting…'; btn.disabled = true; btn.classList.add('loading');

    function handleSubmitResponse(response) {
      return parseJsonResponse(response);
    }
    function processSubmitResult(result) {
      if (!result || result.success !== true) {
        throw new Error(result && result.error ? result.error : 'Submission failed');
      }
      btn.textContent = 'Submit Application →';
      btn.disabled = false;
      btn.classList.remove('loading');
      current = 'success';
      showStep('success');
    }

    console.log('[SWYN] submitting payload to Apps Script:', data);
    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify(data)
    })
    .then(handleSubmitResponse)
    .then(function(result) {
      console.log('[SWYN] Apps Script submission response:', result);
      processSubmitResult(result);
    })
    .catch(function(err) {
      console.warn('Submission attempt 1 failed, retrying…', err);
      setTimeout(function() {
        fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify(data)
        })
        .then(handleSubmitResponse)
        .then(function(result) {
          console.log('[SWYN] Apps Script submission retry response:', result);
          processSubmitResult(result);
        })
        .catch(function(err2) {
          console.error('Submission error after retry:', err2);
          btn.textContent = 'Submit Application →';
          btn.disabled = false;
          btn.classList.remove('loading');
          alert('Could not reach the server. Please check your internet connection and try again. If the problem persists, write to us at mentors@swyn.in');
        });
      }, 2000);
    });
  });
  });

}); // end DOMContentLoaded








// ── Drag & Drop zone setup ──
function initDropZones() {
  document.querySelectorAll('.drop-zone').forEach(function(zone) {
    zone.addEventListener('dragover', function(e) {
      e.preventDefault(); zone.classList.add('dragover');
    });
    zone.addEventListener('dragleave', function(e) {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('dragover');
    });
    zone.addEventListener('drop', function(e) {
      e.preventDefault(); zone.classList.remove('dragover');
      var input = zone.querySelector('input[type=file]');
      if (!input) return;
      var dt = new DataTransfer();
      Array.from(e.dataTransfer.files).forEach(function(f) { dt.items.add(f); });
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    });
  });
}

function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}

function resetDropZone(zoneId, listId, hiddenId) {
  var zone = document.getElementById(zoneId);
  var list = document.getElementById(listId);
  var hidden = document.getElementById(hiddenId);
  if (!zone) return;
  var meta = dropZoneMeta[zoneId] || { icon: '📁', title: 'Drag & drop here', sub: 'or <strong>click to browse</strong>' };
  zone.classList.remove('uploaded');
  var icon = zone.querySelector('.drop-icon-wrap');
  var title = zone.querySelector('.drop-zone-title');
  var sub = zone.querySelector('.drop-zone-sub');
  if (icon) icon.textContent = meta.icon;
  if (title) title.textContent = meta.title;
  if (sub) sub.innerHTML = meta.sub;
  if (list) list.innerHTML = '';
  if (hidden) hidden.value = '';
  var input = zone.querySelector('input[type=file]');
  if (input) input.value = '';
}

var dropZoneMeta = {
  cvZone:      { icon:'📄', title:'Drag & drop your CV here',          sub:'or <strong>click to browse</strong> from your device<br/>PDF or Word · Max 10 MB' },
  photoZone:   { icon:'🖼️', title:'Drag & drop your photo here',       sub:'or <strong>click to browse</strong> from your device<br/>JPG or PNG · Max 5 MB' },
  samplesZone: { icon:'📁', title:'Drag & drop work samples here',     sub:'or <strong>click to browse</strong> · Multiple files allowed<br/>PDF, PPT, Excel, Word · Max 20 MB total' }
};

function handleDropFiles(input, zoneId, listId, hiddenId) {
  return new Promise(function(resolve) {
    if (!input || !input.files || !input.files.length) return resolve([]);
    var zone = document.getElementById(zoneId);
    var list = document.getElementById(listId);
    var hidden = document.getElementById(hiddenId);
    if (!zone || !list || !hidden) return resolve([]);

    var files = Array.from(input.files);
    var sizeLimits = { cvZone: 10*1024*1024, photoZone: 5*1024*1024, samplesZone: 20*1024*1024 };
    var totalSize = files.reduce(function(sum, file) { return sum + file.size; }, 0);
    var maxSize = sizeLimits[zoneId] || 20*1024*1024;
    if (totalSize > maxSize) {
      var field = zone.closest('.field');
      if (field && !field.querySelector('.err-msg')) {
        var err = document.createElement('span');
        err.className = 'err-msg';
        err.textContent = 'Total file size exceeds the limit (' + fmtBytes(maxSize) + '). Please choose smaller files.';
        field.appendChild(err);
      }
      resetDropZone(zoneId, listId, hiddenId);
      return resolve([]);
    }

    zone.classList.add('uploaded');
    zone.style.borderColor = '';
    zone.style.background = '';
    var zoneField = zone.closest('.field');
    if (zoneField) {
      var oldErr = zoneField.querySelector('.err-msg');
      if (oldErr) oldErr.remove();
    }

    var title = zone.querySelector('.drop-zone-title');
    var sub = zone.querySelector('.drop-zone-sub');
    if (title) title.textContent = files.length === 1 ? '✓ File selected' : '✓ ' + files.length + ' files selected';
    if (sub) sub.innerHTML = '<strong>Click or drag</strong> to replace';

    var progressBar = zone.querySelector('.drop-progress');
    var progressFill = zone.querySelector('.drop-progress-fill');
    if (progressBar && progressFill) {
      progressBar.style.display = 'block';
      progressFill.style.width = '0%';
      setTimeout(function() { progressFill.style.width = '70%'; }, 40);
      setTimeout(function() { progressFill.style.width = '100%'; }, 420);
      setTimeout(function() { progressBar.style.display = 'none'; progressFill.style.width = '0%'; }, 900);
    }

    list.innerHTML = '';
    files.forEach(function(file, idx) {
      var li = document.createElement('li');
      li.innerHTML = '<span>📎</span>'
        + '<span class="fname">' + escH(file.name) + '</span>'
        + '<span class="fsize">' + fmtBytes(file.size) + '</span>'
        + '<button class="fremove" type="button" title="Remove" onclick="removeDropFile(this,\'' + zoneId + '\',\'' + listId + '\',\'' + hiddenId + '\',' + idx + ')">&#10005;</button>';
      list.appendChild(li);
    });

    hidden.value = '';
    var typeMap = { cvZone:'cv', photoZone:'photo', samplesZone:'worksamples' };
    var uploadType = typeMap[zoneId] || 'cv';

    var uploadPromises = files.map(function(file) {
      return new Promise(function(resolveUpload) {
        var reader = new FileReader();
        reader.onload = function(ev) {
          var base64 = ev.target.result.split(',')[1];
          fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
              action: 'uploadFile',
              type: uploadType,
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              data: base64
            })
          })
          .then(function(response) {
            if (response.type === 'opaque') {
              console.warn('[SWYN] no-cors upload response is opaque; assuming upload request was sent');
              resolveUpload(null);
              return null;
            }
            return response.text().then(function(text) {
              if (!response.ok) {
                throw new Error('Upload failed with status ' + response.status + ': ' + text);
              }
              try {
                return JSON.parse(text);
              } catch (err) {
                throw new Error('Upload invalid JSON: ' + text);
              }
            });
          })
          .then(function(result) {
            if (result === null) {
              return;
            }
            if (!result || result.success !== true || !result.url) {
              throw new Error(result && result.error ? result.error : 'Upload failed');
            }
            console.log('[SWYN] uploaded file:', file.name, 'type:', uploadType, 'url:', result.url);
            resolveUpload(result.url);
          })
          .catch(function(err) {
            console.warn('Upload failed for ' + file.name + ':', err);
            resolveUpload(null);
          });
        };
        reader.onerror = function() {
          console.error('FileReader could not read: ' + file.name);
          resolveUpload(null);
        };
        reader.readAsDataURL(file);
      });
    });

    var finishPromise = Promise.all(uploadPromises).then(function(urls) {
      var validUrls = urls.filter(function(url) { return url; });
      hidden.value = validUrls.length ? validUrls.join(', ') : '';
      return validUrls;
    });
    fileUploadPromises[zoneId] = finishPromise;
    finishPromise.then(resolve, function() { resolve([]); });
  });
}

function removeDropFile(btn, zoneId, listId, hiddenId, idx) {
  var zone = document.getElementById(zoneId);
  var list = document.getElementById(listId);
  var hidden = document.getElementById(hiddenId);
  var input = zone.querySelector('input[type=file]');
  var dt = new DataTransfer();
  Array.from(input.files).forEach(function(f, i){ if (i !== idx) dt.items.add(f); });
  input.files = dt.files;
  if (input.files.length === 0) {
    // Reset zone to empty state
    zone.classList.remove('uploaded');
    var meta = dropZoneMeta[zoneId] || {};
    zone.querySelector('.drop-icon-wrap').textContent = meta.icon || '📁';
    zone.querySelector('.drop-zone-title').textContent = meta.title || 'Drag & drop here';
    zone.querySelector('.drop-zone-sub').innerHTML = meta.sub || 'or <strong>click to browse</strong>';
    list.innerHTML = ''; hidden.value = '';
  } else {
    input.dispatchEvent(new Event('change'));
  }
}

function escH(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Defined early so inline onchange/onkeydown attributes can call these before body scripts load
function allowPhoneKeys(e) {
  // Allow: backspace, delete, tab, escape, enter, arrows, home, end
  if ([8,9,13,27,46,35,36,37,38,39,40].indexOf(e.keyCode) !== -1) return true;
  // Allow: + only at start (position 0)
  if (e.key === '+') {
    var inp = e.target;
    if (inp.selectionStart === 0 && inp.value.indexOf('+') === -1) return true;
    e.preventDefault(); return false;
  }
  // Allow: spaces and hyphens for formatting
  if (e.key === ' ' || e.key === '-') return true;
  // Allow: numbers 0-9
  if ((e.keyCode >= 48 && e.keyCode <= 57) || (e.keyCode >= 96 && e.keyCode <= 105)) return true;
  // Block everything else
  e.preventDefault(); return false;
}

function validatePhone(inp) {
  // Remove everything except +, digits, spaces, hyphens
  var val = inp.value.replace(/[^\d\+\s\-]/g, '');
  inp.value = val;
  // Count digits only
  var digits = val.replace(/\D/g,'');
  var wrap = inp.closest('.field');
  var err = wrap && wrap.querySelector('.phone-err');
  if (digits.length > 0 && (digits.length < 7 || digits.length > 15)) {
    inp.style.borderColor = '#e03030';
    if (!err) {
      var e = document.createElement('span');
      e.className = 'err-msg phone-err';
      e.textContent = 'Enter a valid phone number (7–15 digits with country code).';
      wrap.appendChild(e);
    }
  } else {
    inp.style.borderColor = digits.length >= 7 ? 'var(--orange)' : '';
    if (err) err.remove();
  }
}
function showOther(select, boxId, triggerVal) {
  var box = document.getElementById(boxId);
  if (!box) return;
  if (select.value === triggerVal) {
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
  } else {
    box.style.display = 'none';
    var inp = box.querySelector('input');
    if (inp) inp.value = '';
  }
}
function fileSelected(input, labelId) {
  var label = document.getElementById(labelId);
  var box = input.closest('.upload-box');
  var field = box ? box.closest('.field') : null;
  if (input.files && input.files.length > 0) {
    var name = input.files.length > 1 ? input.files.length + ' files selected' : input.files[0].name;
    label.textContent = '✓ ' + name;
    if (box) { box.classList.add('upload-done'); box.style.borderStyle = 'solid'; box.style.borderColor = ''; box.style.background = ''; }
    if (field) { var e = field.querySelector('.err-msg'); if(e) e.remove(); }
  }
}
var selectedExpertise = [];
function addExpertise(select) {
  var val = select.value;
  if (!val) return;
  if (val === 'Other') {
    document.getElementById('expertiseSelectWrap').style.display = 'none';
    document.getElementById('expertiseOtherBox').style.display = 'block';
    document.getElementById('expertiseOther').focus();
    select.value = '';
    return;
  }
  if (selectedExpertise.indexOf(val) === -1) {
    selectedExpertise.push(val);
    renderTags();
    updateExpertiseHidden();
  }
  select.value = '';
}
function addExpertiseOther() {
  var val = document.getElementById('expertiseOther').value.trim();
  if (!val) return;
  if (selectedExpertise.indexOf(val) === -1) {
    selectedExpertise.push(val);
    renderTags();
    updateExpertiseHidden();
  }
  document.getElementById('expertiseOther').value = '';
  document.getElementById('expertiseOtherBox').style.display = 'none';
  document.getElementById('expertiseSelectWrap').style.display = 'block';
}
function removeExpertise(val) {
  selectedExpertise = selectedExpertise.filter(function(v){return v!==val;}); renderTags(); updateExpertiseHidden();
}
function renderTags() {
  var c = document.getElementById('expertiseTags'); c.innerHTML = '';
  selectedExpertise.forEach(function(val) {
    var tag = document.createElement('span');
    tag.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:var(--orange-muted);border:1.5px solid var(--orange);color:var(--orange);border-radius:20px;padding:4px 12px;font-size:13px;font-weight:500;';
    tag.innerHTML = val + ' <button type="button" onclick="removeExpertise(\'' + val.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')" style="background:none;border:none;cursor:pointer;color:var(--orange);font-size:15px;line-height:1;padding:0;">&#10005;</button>';
    c.appendChild(tag);
  });
  var wrap = c.closest('.field'); var e = wrap && wrap.querySelector('.err-msg'); if (e) e.remove();
}
function updateExpertiseHidden() { document.getElementById('areasOfExpertiseHidden').value = selectedExpertise.join(', '); }
var notableCompanies = [];
function addNotableCompany() {
  var inp = document.getElementById('notableCompanyInput');
  var val = inp.value.trim(); if (!val) return;
  if (notableCompanies.indexOf(val) === -1) { notableCompanies.push(val); renderCompanyTags(); updateCompaniesHidden(); }
  inp.value = '';
}
function removeNotableCompany(val) {
  notableCompanies = notableCompanies.filter(function(v){return v!==val;}); renderCompanyTags(); updateCompaniesHidden();
}
function renderCompanyTags() {
  var c = document.getElementById('notableCompanyTags'); c.innerHTML = '';
  notableCompanies.forEach(function(val) {
    var tag = document.createElement('span');
    tag.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:var(--orange-muted);border:1.5px solid var(--orange);color:var(--orange);border-radius:20px;padding:4px 12px;font-size:13px;font-weight:500;';
    tag.innerHTML = val + ' <button type="button" onclick="removeNotableCompany(\'' + val.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')" style="background:none;border:none;cursor:pointer;color:var(--orange);font-size:15px;line-height:1;padding:0;">&#10005;</button>';
    c.appendChild(tag);
  });
}
function updateCompaniesHidden() { document.getElementById('notableCompaniesHidden').value = notableCompanies.join(', '); }
var pastClients = [];
function addPastClient() {
  var inp = document.getElementById('pastClientInput');
  var val = inp.value.trim(); if (!val) return;
  if (pastClients.indexOf(val) === -1) { pastClients.push(val); renderPastClientTags(); updatePastClientsHidden(); }
  inp.value = '';
}
function removePastClient(val) {
  pastClients = pastClients.filter(function(v){return v!==val;}); renderPastClientTags(); updatePastClientsHidden();
}
function renderPastClientTags() {
  var c = document.getElementById('pastClientTags'); c.innerHTML = '';
  pastClients.forEach(function(val) {
    var tag = document.createElement('span');
    tag.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:var(--orange-muted);border:1.5px solid var(--orange);color:var(--orange);border-radius:20px;padding:4px 12px;font-size:13px;font-weight:500;';
    tag.innerHTML = val + ' <button type="button" onclick="removePastClient(\'' + val.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')" style="background:none;border:none;cursor:pointer;color:var(--orange);font-size:15px;line-height:1;padding:0;">&#10005;</button>';
    c.appendChild(tag);
  });
}
function updatePastClientsHidden() { document.getElementById('pastClientsHidden').value = pastClients.join(', '); }
function selectRating(fieldId, groupId, val) {
  document.getElementById(fieldId).value = val;
  var btns = document.getElementById(groupId).querySelectorAll('.rating-btn');
  btns.forEach(function(b){b.classList.remove('active');}); btns[val-1].classList.add('active');
  var wrap = document.getElementById(groupId).closest('.field');
  var e = wrap && wrap.querySelector('.err-msg'); if (e) e.remove();
  document.getElementById(groupId).style.outline = '';
}