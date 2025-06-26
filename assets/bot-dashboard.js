/* 
	Enhanced Bot Dashboard JS v2.0
	Modern Ajax-powered bot protection interface
*/

jQuery(document).ready(function($) {
	
	// Initialize bot dashboard variables
	var botDashboard = {
		vars: {
			xhr: null,
			count: 0,
			items: [],
			type: 'init',
			bulk: '',
			sort: 'last_seen',
			order: 'desc',
			search: '',
			filter: 'all',
			status: 'all',
			jump: 1,
			offset: 0,
			limit: 10,
			pages: 1,
			toggle: 1,
			fx: 1,
			nonce: window.botDashboard ? window.botDashboard.nonce : '',
			unblock_nonce: window.botDashboard ? window.botDashboard.unblock_nonce : '',
			ajaxurl: window.botDashboard ? window.botDashboard.ajaxurl : ajaxurl,
			debug: window.botDashboard ? window.botDashboard.debug : false,
			dots: '<span class="bot-loading-dots">Loading</span>'
		}
	};
	
	// Debug logging
	function debugLog(message, data) {
		if (botDashboard.vars.debug) {
			console.log('[Bot Dashboard] ' + message, data || '');
		}
	}
	
	debugLog('Bot Dashboard script loaded');
	debugLog('botDashboard object:', window.botDashboard);
	
	// Check if botDashboard object exists
	if (typeof window.botDashboard === 'undefined') {
		console.error('botDashboard object not found. Script localization failed.');
		showError('Configuration error. Please refresh the page.');
		return;
	}
	
	// Load dashboard stats immediately
	loadBotStats();
	loadBotActivity();
	
	// Auto-refresh every 30 seconds
	setInterval(function() {
		loadBotStats();
		loadBotActivity();
	}, 30000);
	
	// Double-click prevention
	document.ondblclick = function() {
		if (window.getSelection) window.getSelection().removeAllRanges();
		else if (document.selection) document.selection.empty();
	}
	
	// Tools toggle
	$('.bot-tools').hide();
	$(document).on('click', '.bot-tools-link', function(e) {
		e.preventDefault();
		$('.bot-tools').slideToggle(300);
		$(this).blur();
	});
	
	// Sound effects toggle
	$(document).on('click', '.bot-fx-link', function(e) {
		e.preventDefault();
		if (botDashboard.vars.fx === 0) {
			botDashboard.vars.fx = 1;
			$(this).text($(this).data('fx-on') || 'FX: ON');
		} else {
			botDashboard.vars.fx = 0;
			$(this).text($(this).data('fx-off') || 'FX: OFF');
		}
		botDashboard.vars.type = 'items';
		loadBotActivity();
		$(this).blur();
	});
	
	// Row hover effects
	$(document).on('mouseenter', '.bot-row', function(e) {
		$(this).find('.bot-select-target').addClass('bot-visible');
	}); 
	$(document).on('mouseleave', '.bot-row', function(e) {
		$(this).find('.bot-select-target').removeClass('bot-visible');
	});
	
	// Toggle detailed view
	$(document).on('click', '.bot-toggle-link', function(e) {
		e.preventDefault();
		if (botDashboard.vars.toggle == 2) {
			$(this).text($(this).data('view-adv') || 'View Advanced');
			$('.bot-data').slideUp();
			botDashboard.vars.toggle = 1;
			$('.bot-request a').each(function() {
				var request = $(this).data('request');
				var req = request.substring(0, 50) + '...';
				if (request.length > 50) $(this).text(req).fadeIn(300);
			});
		} else {
			$(this).text($(this).data('view-bsc') || 'View Basic');
			$('.bot-data').slideDown();
			botDashboard.vars.toggle = 2;
			$('.bot-request a').each(function() {
				var request = $(this).data('request');
				$(this).text(request).fadeIn(300);
			});
		}
		botDashboard.vars.type = 'items';
		loadBotActivity();
		$(this).blur();
	});
	
	// Double-click to toggle details
	$(document).on('dblclick', '.bot-row', function(e) {
		e.preventDefault();
		var data = $(this).find('.bot-data');
		var current = $(this).find('.bot-request a');
		var request = current.data('request');
		var req = request.substring(0, 50) + '...';
		if (data.is(':visible')) {
			if (request.length > 50) current.text(req).fadeIn(300);
		} else {
			current.text(request).fadeIn(300);
		}
		data.slideToggle(300);
	});
	
	// Host lookup
	$(document).on('click', '.bot-hostlookup-link', function(e) {
		e.preventDefault();
		var id = $(this).data('id');
		var ip = $(this).data('ip');
		$('.bot-hostlookup-id-' + id).html(botDashboard.vars.dots);
		performHostLookup(id, ip);
		$(this).blur();
	});
	
	// Reload functionality
	$(document).on('click', '.bot-addvisit-link, .bot-reload-link', function(e) {
		e.preventDefault();
		clearBotData();
		botDashboard.vars.type = 'init';
		if ($(this).hasClass('bot-addvisit-link')) botDashboard.vars.type = 'add';
		loadBotActivity();
		$(this).blur();
	});
	
	$(document).on('click', '.bot-reload-current', function(e) {
		e.preventDefault();
		botDashboard.vars.type = 'init';
		loadBotActivity();
		$(this).blur();
	});
	
	// Delete functionality
	$(document).on('click', '.bot-delete-link', function(e) {
		e.preventDefault();
		$(this).blur();
		
		if (confirm('Are you sure you want to delete all selected items?')) {
			clearBotData();
			botDashboard.vars.type = 'delete';
			if (botDashboard.vars.fx === 1) {
				playSound('delete');
			}
			loadBotActivity();
		}
	});
	
	// Select all functionality
	$(document).on('change', '.bot-select-all', function() {
		$('.bot-id').prop('checked', $(this).prop('checked'));
	});
	
	$(document).on('change', '.bot-id', function() {
		if ($('.bot-id:checkbox:not(:checked)').length == 0) {
			var checked = true;
		} else {
			var checked = false;
		}
		$('.bot-select-all').prop('checked', checked);
	});
	
	// Bulk actions
	$('.bot-action-bulk').on('click', function(e) {
		e.preventDefault();
		var bulk = $('.bot-select-bulk').val();
		var items = [];
		$('.bot-id:checked').each(function() {
			if (bulk == 'delete') botDashboard.vars.count = botDashboard.vars.count - 1;
			items.push($(this).val());
		});
		
		if (botDashboard.vars.offset == botDashboard.vars.count) {
			botDashboard.vars.offset = Math.abs(botDashboard.vars.offset - botDashboard.vars.limit);
		}
		var jump = Math.ceil(botDashboard.vars.offset / botDashboard.vars.limit) + 1;
		
		if (botDashboard.vars.fx === 1 && bulk == 'delete') {
			playSound('delete');
		}
		
		botDashboard.vars.jump = jump;
		botDashboard.vars.bulk = bulk;
		botDashboard.vars.items = items;
		botDashboard.vars.type = 'bulk';
		loadBotActivity();
		$(this).blur();
	});
	
	// Individual actions (Ban, Warn, Restore, etc.)
	$(document).on('click', '.bot-action-ban, .bot-action-warn, .bot-action-restore, .bot-action-whitelist', function(e) {
		e.preventDefault();
		var fx = botDashboard.vars.fx;
		var target = $(this).siblings('.bot-select-target').val() || 'ip';
		var action = $(this).data('action');
		var bulk = action + '-' + target;
		var id = $(this).data('id');
		var items = [];
		items.push(id);
		
		botDashboard.vars.bulk = bulk;
		botDashboard.vars.items = items;
		botDashboard.vars.type = 'bulk';
		
		if (fx === 1) {
			playSound(action);
		}
		
		loadBotActivity();
		$(this).blur();
	});
	
	// Unblock bot functionality
	$(document).on('click', '.unblock-bot', function() {
		var ip = $(this).data('ip');
		var button = $(this);
		
		if (!ip) {
			showError('Invalid IP address');
			return;
		}
		
		if (!confirm('Are you sure you want to unblock IP: ' + ip + '?')) {
			return;
		}
		
		button.prop('disabled', true).text('Unblocking...');
		
		debugLog('Unblocking IP:', ip);
		
		$.ajax({
			url: botDashboard.vars.ajaxurl,
			type: 'POST',
			dataType: 'json',
			data: {
				action: 'bot_blocker_unblock',
				nonce: botDashboard.vars.unblock_nonce,
				ip: ip
			},
			success: function(response) {
				debugLog('Unblock response:', response);
				
				if (response && response.success) {
					button.closest('tr').fadeOut(function() {
						$(this).remove();
					});
					showNotice('IP unblocked successfully', 'success');
					// Reload stats after unblocking
					loadBotStats();
					loadBotActivity();
				} else {
					var errorMsg = response && response.data ? response.data : 'Unknown error';
					showNotice('Failed to unblock IP: ' + errorMsg, 'error');
					button.prop('disabled', false).text('Unblock');
				}
			},
			error: function(xhr, status, error) {
				debugLog('Unblock AJAX error:', {xhr: xhr, status: status, error: error});
				
				var errorMsg = 'Error occurred while unblocking IP';
				if (xhr.responseText) {
					try {
						var response = JSON.parse(xhr.responseText);
						if (response.data) {
							errorMsg += ': ' + response.data;
						}
					} catch (e) {
						errorMsg += ': ' + error;
					}
				} else {
					errorMsg += ': ' + error;
				}
				
				showNotice(errorMsg, 'error');
				button.prop('disabled', false).text('Unblock');
			}
		});
	});
	
	// Pagination
	$('.bot-page-next').on('click', function(e) {
		e.preventDefault();
		if (botDashboard.vars.offset < botDashboard.vars.count) {
			botDashboard.vars.offset = botDashboard.vars.offset + botDashboard.vars.limit;
			botDashboard.vars.jump = botDashboard.vars.jump + 1;
			botDashboard.vars.type = 'next';
			loadBotActivity();
		}
		$(this).blur();
	});
	
	$('.bot-page-prev').on('click', function(e) {
		e.preventDefault();
		if (botDashboard.vars.offset > 0) {
			botDashboard.vars.offset = botDashboard.vars.offset - botDashboard.vars.limit;
			botDashboard.vars.jump = botDashboard.vars.jump - 1;
			botDashboard.vars.type = 'prev';
			loadBotActivity();
		}
		$(this).blur();
	});
	
	$('.bot-page-jump').on('keypress', function(e) {
		var code = e.keyCode || e.which;
		if (code == 13) {
			e.preventDefault();
			var jump = parseInt($(this).val());
			if (jump <= 0) jump = 1;
			if (jump > botDashboard.vars.pages) jump = botDashboard.vars.pages;
			botDashboard.vars.offset = (jump - 1) * botDashboard.vars.limit;
			botDashboard.vars.jump = jump;
			botDashboard.vars.type = 'jump';
			loadBotActivity();
		}
	});
	
	// Items per page
	$('.bot-hover-info').hide();
	$('.bot-page-items').hover(function() {
		$('.bot-hover-info').css('display', 'inline-block');
	}, function() {
		$('.bot-hover-info').css('display', 'none');
	});
	
	$('.bot-page-items').val(botDashboard.vars.limit).on('keypress', function(e) {
		var code = e.keyCode || e.which;
		if (code == 13) {
			e.preventDefault();
			var limit_new = parseInt($(this).val());
			var limit_old = $(this).data('limit');
			if (limit_new <= 0) {
				limit_new = limit_old;
				$(this).val(limit_old);
			}
			if (limit_new > 50) {
				if (confirm('Large numbers of rows may impact performance. Continue?')) {
					botDashboard.vars.limit = limit_new;
					botDashboard.vars.offset = 0;
					botDashboard.vars.jump = 1;
					botDashboard.vars.type = 'items';
					loadBotActivity();
				} else {
					$(this).val(limit_old);
				}
			} else {
				botDashboard.vars.limit = limit_new;
				botDashboard.vars.offset = 0;
				botDashboard.vars.jump = 1;
				botDashboard.vars.type = 'items';
				loadBotActivity();
			}
		}
	});
	
	// Search and filter
	$('.bot-action-search, .bot-select-filter').on('keypress change', function(e) {
		var go = false;
		var code = e.keyCode || e.which;
		if (code == 13 && e.type == 'keypress' && this.className.indexOf('bot-action-search') !== -1) {
			e.preventDefault();
			var search = $(this).val();
			var filter = $('.bot-select-filter').val();
			go = true;
		} else if (e.type == 'change' && this.className.indexOf('bot-select-filter') !== -1) {
			e.preventDefault();
			var search = $('.bot-action-search').val();
			var filter = $(this).val();
			if (search) go = true;
		}
		if (go == true) {
			if (!filter) filter = '';
			botDashboard.vars.search = search;
			botDashboard.vars.filter = filter;
			botDashboard.vars.offset = 0;
			botDashboard.vars.count = 0;
			botDashboard.vars.jump = 1;
			botDashboard.vars.type = 'search';
			loadBotActivity();
		}
	});
	
	// Sort and order
	$('.bot-select-sort, .bot-select-order').on('change', function(e) {
		e.preventDefault();
		var sort = $('.bot-select-sort').val();
		var order = $('.bot-select-order').val();
		if (!sort) sort = 'last_seen';
		if (!order) order = 'desc';
		botDashboard.vars.sort = sort;
		botDashboard.vars.order = order;
		botDashboard.vars.type = 'sort';
		loadBotActivity();
		$(this).blur();
	});
	
	// Status filter
	$('.bot-select-status').on('change', function(e) {
		e.preventDefault();
		var status = $(this).val();
		if (!status) status = 'all';
		botDashboard.vars.offset = 0;
		botDashboard.vars.count = 0;
		botDashboard.vars.jump = 1;
		botDashboard.vars.type = 'status';
		botDashboard.vars.status = status;
		loadBotActivity();
		$(this).blur();
	});
	
	// Core Functions
	function performHostLookup(id, ip) {
		if (botDashboard.vars.xhr != null) {
			botDashboard.vars.xhr.abort();
			botDashboard.vars.xhr = null;
		}
		botDashboard.vars.xhr = $.ajax({
			type: 'POST',
			url: botDashboard.vars.ajaxurl,
			data: {
				action: 'bot_hostlookup',
				nonce: botDashboard.vars.nonce,
				id: id,
				ip: ip
			},
			success: function(data) {
				$('.bot-hostlookup-id-' + id).html(data);
			}
		});
	}
	
	function loadBotActivity() {
		prepareBotActivity();
		if (botDashboard.vars.xhr != null) {
			botDashboard.vars.xhr.abort();
			botDashboard.vars.xhr = null;
		}
		botDashboard.vars.xhr = $.ajax({
			type: 'POST',
			url: botDashboard.vars.ajaxurl,
			data: {
				action: 'bot_blocker_activity',
				nonce: botDashboard.vars.nonce,
				items: botDashboard.vars.items,
				type: botDashboard.vars.type,
				bulk: botDashboard.vars.bulk,
				sort: botDashboard.vars.sort,
				order: botDashboard.vars.order,
				search: botDashboard.vars.search,
				filter: botDashboard.vars.filter,
				status: botDashboard.vars.status,
				jump: botDashboard.vars.jump,
				count: botDashboard.vars.count,
				limit: botDashboard.vars.limit,
				offset: botDashboard.vars.offset,
				toggle: botDashboard.vars.toggle,
				fx: botDashboard.vars.fx
			},
			success: function(data) {
				processBotResponse(data);
				updateBotUI();
			},
			error: function(xhr, status, error) {
				debugLog('Activity AJAX error:', {xhr: xhr, status: status, error: error});
				showError('Failed to load bot activity: ' + error);
				setErrorValues();
			}
		});
	}
	
	function prepareBotActivity() {
		$('.bot-armory').show();
		$('.bot-response').empty();
		$('.bot-loading').show();
		var tools = $('.bot-tools');
		if (tools.is(':visible')) tools.show();
		else tools.hide();
		if (botDashboard.vars.type != 'bulk' && botDashboard.vars.search != '') botDashboard.vars.type = 'search';
	}
	
	function processBotResponse(data) {
		var temp = $(data);
		var div = temp.filter('.bot-count-data');
		var count = parseInt(div.data('count')) || 0;
		botDashboard.vars.count = count;
		$('.bot-loading').hide();
		if (botDashboard.vars.type == 'delete') $('.bot-tools').hide();
		$('.bot-count').html(div.html());
		$('.bot-response').empty();
		
		if (count > 0) {
			var response = temp.not('.bot-count-data');
			response.filter('.bot-row').each(function(i) {
				$(this).hide().appendTo($('.bot-response')).delay((i++) * 50).fadeTo(100, 1);
				if (botDashboard.vars.toggle == 2) {
					$('.bot-toggle-link').text($('.bot-toggle-link').data('view-bsc') || 'View Basic');
					$(this).find('.bot-data').show();
					$('.bot-request a').each(function() {
						var request = $(this).data('request');
						$(this).text(request).fadeIn(300);
					});
				} else {
					$('.bot-toggle-link').text($('.bot-toggle-link').data('view-adv') || 'View Advanced');
					$(this).find('.bot-data').hide();
					$('.bot-request a').each(function() {
						var request = $(this).data('request');
						var req = request.substring(0, 50) + '...';
						if (request.length > 50) $(this).text(req).fadeIn(300);
					});
				}
				$(this).find('.bot-select-target').removeClass('bot-visible');
				var date = $(this).find('.bot-date').html().replace(/@/gi, '<span class="bot-at">@</span>');
				$(this).find('.bot-date').html(date);
			});
			var height = $('.bot-response').height();
			$('.bot-loading').css('min-height', height + 'px');
		} else {
			div.hide().appendTo($('.bot-response')).delay(50).fadeTo(100, 1);
			$('.bot-loading').css('min-height', '80px');
		}
		
		var fx = $('.bot-fx-link');
		if (botDashboard.vars.fx === 0) fx.text(fx.data('fx-off') || 'FX: OFF');
		else fx.text(fx.data('fx-on') || 'FX: ON');
	}
	
	function updateBotUI() {
		botDashboard.vars.pages = Math.ceil(botDashboard.vars.count / botDashboard.vars.limit);
		if (botDashboard.vars.pages === 0) botDashboard.vars.pages = 1;
		
		if ((botDashboard.vars.count - botDashboard.vars.offset) <= botDashboard.vars.limit) {
			$('.bot-page-next').prop('disabled', true);
		} else {
			$('.bot-page-next').prop('disabled', false);
		}
		
		if (botDashboard.vars.offset > 0) {
			$('.bot-page-prev').prop('disabled', false);
		} else {
			$('.bot-page-prev').prop('disabled', true);
		}
		
		if (botDashboard.vars.count === 0) {
			$('.bot-paging').hide();
		} else {
			$('.bot-paging').show();
		}
		
		$('.bot-page-items').data('limit', botDashboard.vars.limit);
		$('.bot-select-bulk').val('');
		$('.bot-select-sort').val(botDashboard.vars.sort);
		$('.bot-select-order').val(botDashboard.vars.order);
		$('.bot-action-search').val(botDashboard.vars.search);
		$('.bot-select-filter').val(botDashboard.vars.filter);
		$('.bot-select-status').val(botDashboard.vars.status);
		$('.bot-page-jump').val(botDashboard.vars.jump);
		$('.bot-page-total').html(botDashboard.vars.pages);
		$('.bot-select-all').prop('checked', false);
	}
	
	function clearBotData() {
		botDashboard.vars.count = 0;
		botDashboard.vars.items = [];
		botDashboard.vars.type = 'init';
		botDashboard.vars.bulk = '';
		botDashboard.vars.sort = 'last_seen';
		botDashboard.vars.order = 'desc';
		botDashboard.vars.search = '';
		botDashboard.vars.filter = 'all';
		botDashboard.vars.status = 'all';
		botDashboard.vars.jump = 1;
		botDashboard.vars.offset = 0;
		$('.bot-action-search').val('');
	}
	
	function loadBotStats() {
		debugLog('Loading bot stats...');
		
		$.ajax({
			url: botDashboard.vars.ajaxurl,
			type: 'POST',
			dataType: 'json',
			data: {
				action: 'bot_blocker_stats',
				nonce: botDashboard.vars.nonce
			},
			success: function(response) {
				debugLog('Stats response:', response);
				
				if (response && response.success && response.data) {
					var data = response.data;
					
					// Update stats with fallback values
					$('#total-blocked').text(data.total_blocked || 0);
					$('#today-blocked').text(data.today_blocked || 0);
					$('#week-blocked').text(data.week_blocked || 0);
					
					// Update top blocked IPs
					var topBlockedHtml = '<ul class="top-blocked-list">';
					if (data.top_blocked_ips && data.top_blocked_ips.length > 0) {
						$.each(data.top_blocked_ips, function(index, item) {
							topBlockedHtml += '<li>';
							topBlockedHtml += '<span class="ip-address">' + escapeHtml(item.ip_address) + '</span>';
							topBlockedHtml += '<span class="hit-count">' + (item.hits || 0) + ' hits</span>';
							topBlockedHtml += '</li>';
						});
					} else {
						topBlockedHtml += '<li>No blocked IPs found</li>';
					}
					topBlockedHtml += '</ul>';
					$('#top-blocked-ips').html(topBlockedHtml);
				} else {
					var errorMsg = response && response.data ? response.data : 'Unknown error';
					console.error('Failed to load bot stats:', errorMsg);
					setErrorValues();
				}
			},
			error: function(xhr, status, error) {
				debugLog('Stats AJAX error:', {xhr: xhr, status: status, error: error});
				
				var errorMsg = 'Failed to load statistics';
				if (xhr.responseText) {
					// Check if response is HTML (likely an error page)
					if (xhr.responseText.indexOf('<') === 0) {
						errorMsg += ' (Server returned HTML instead of JSON - check for PHP errors)';
						console.error('Server response:', xhr.responseText.substring(0, 200) + '...');
					} else {
						try {
							var response = JSON.parse(xhr.responseText);
							if (response.data) {
								errorMsg += ': ' + response.data;
							}
						} catch (e) {
							errorMsg += ': ' + error;
						}
					}
				} else {
					errorMsg += ': ' + error;
				}
				
				console.error('AJAX Error loading stats:', errorMsg);
				setErrorValues();
				showError(errorMsg);
			}
		});
	}
	
	function setErrorValues() {
		$('#total-blocked').text('Error');
		$('#today-blocked').text('Error');
		$('#week-blocked').text('Error');
		$('#top-blocked-ips').html('<ul class="top-blocked-list"><li>Error loading data</li></ul>');
	}
	
	function showNotice(message, type) {
		var noticeClass = type === 'success' ? 'notice-success' : 'notice-error';
		var notice = $('<div class="notice ' + noticeClass + ' is-dismissible"><p>' + escapeHtml(message) + '</p></div>');
		$('.wrap h1').after(notice);
		
		setTimeout(function() {
			notice.fadeOut(function() {
				$(this).remove();
			});
		}, 5000);
	}
	
	function showError(message) {
		showNotice(message, 'error');
	}
	
	function escapeHtml(text) {
		var map = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#039;'
		};
		return text.replace(/[&<>"']/g, function(m) { return map[m]; });
	}
	
	function playSound(action) {
		// Simple sound effect simulation using Web Audio API
		if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
			var audioContext = new (window.AudioContext || window.webkitAudioContext)();
			var oscillator = audioContext.createOscillator();
			var gainNode = audioContext.createGain();
			
			oscillator.connect(gainNode);
			gainNode.connect(audioContext.destination);
			
			var frequency = 440; // Default frequency
			switch(action) {
				case 'ban':
					frequency = 200; // Low tone for ban
					break;
				case 'warn':
					frequency = 600; // Mid tone for warn
					break;
				case 'restore':
					frequency = 800; // High tone for restore
					break;
				case 'delete':
					frequency = 150; // Very low tone for delete
					break;
			}
			
			oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
			oscillator.type = 'sine';
			
			gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
			gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
			
			oscillator.start(audioContext.currentTime);
			oscillator.stop(audioContext.currentTime + 0.3);
		}
	}
	
});