
var counter = 0; 
// My localStorage
var LS = {
	prepend: 'anti-censorship-',
	get: function(k) {
		var self = this;
		return $.parseJSON(window.localStorage.getItem(this.prepend+k));
	},
	set: function(k, v) {
		return window.localStorage.setItem(this.prepend+k.toString(), JSON.stringify(v));
	}
};

// Anti-censorship, yo
var Anti = {

	init: function() {
		// Inject new sort options
		var extraHTML = '<option value="rating">Rating (+)</option>'+
	                    '<option value="workload">Workload (+)</option>';
		$('#sort-by').append(extraHTML);

		$('#submit-button').click(function() {
			// Kind of a hack; on pressing submit, switch to subject sort mode
			// so we don't have to deal with fetching data for ratings
			$('#sort-by option').removeAttr('selected');
			$('#sort-by option[value=subject]').attr('selected', true);
		});

		// Variables
		this.results = App.results;
		this.courses = App.results.models;

		// Bind to native app
		this.results.bind('fetchAllComplete', this.fetchEvalsAndRender, this);
		this.results.bind('changedSortOrder', this.fetchEvalsAndRender, this);
		this.results.bind('changedSortOrder', this.sortByRating, this);
	},

	render: function(course, ratings_rend, self) {
		// We sort by the current sort dropdown selection
		var sortBy = $('#sort-by').find(':selected').attr('value');

		// HACK use alternate method sortByRating to render
		// Had to do this to avoid weird async bug on time deadline
		if (sortBy == 'rating') {
			return;
		}

		// Get the search result currently rendered in the DOM that has the same ID
		var id = course.get('id');
		var $searchContainer = $('#search_results .content.scroller');
		var $searchResults = $searchContainer.find('.list-item');
		var $existingResult = $searchContainer.find('.list-item[data-id='+id+']');

		if (sortBy != 'rating' && sortBy != 'workload' && sortBy != 'workload-rev') {
			// We'll make it easy on ourselves for the old sort indexes.
			// Instead of writing a comparator function, let's accept that the
			// sort order of the original app is correct and simply insert rating HTML
			// at the right place
			var ratingHTML = self.getRatingHTMLForCourse(ratings_rend);
			$existingResult.find('.meeting').prepend(ratingHTML);
		} else {

			if (sortBy == 'workload' || sortBy == 'workload-rev') {

				// We render the course, moving the courses in the list with the same ID
				// to the top, then inserting with insertion sort (big O of N^2)
				var sortAttribute = 'data-'+sortBy;

				$searchResults.each(function(idx, result) {

					// The value of the sort attribute for the iteration of
					// the search list, e.g. value of `data-rating` for the item
					var comparatorValue = $(result).find('.ratings span['+sortAttribute+']').attr(sortAttribute);
					// Sort value of the course to be inserted
					var sortValue = (ratings_rend[sortBy] || 0);

					/*
					var myclass = $existingResult.find('h5').text();
					var theclass = $(result).find('h5').text();
					
					console.log('comparing your class ' + myclass + ' with the list item ' + theclass);
					if (!$(result).attr('data-new')) {
						console.log('inserting right away since we hit the old items');
					} else if (sortValue >= comparatorValue) {
						console.log('your class value (' + sortValue + ') is BIGGER than the other ' + comparatorValue + '. inserting..');
					
					} else {
						console.log('your class value (' + sortValue + ') is smaller than the other ' + comparatorValue);
					}
					*/

					// All prepended courses get a data-new attribute, so if we don't
					// see data-new we're at the unsorted results.
				    if (!$(result).attr('data-new') || sortValue >= comparatorValue) {
				    	// Insert here
				    	var ratingHTML = self.getRatingHTMLForCourse(ratings_rend);
				    	$existingResult.attr('data-new', true);
						$existingResult.find('.meeting').prepend(ratingHTML);
						// If you reached yourself, there's no need to move
						if ($existingResult.attr('data-id') != $(result).attr('data-id')) {
				    		$existingResult.insertBefore(result);
				    	}
				    	return false;
				    }
				});
			} else {
				console.log('Something is fucked up');
				console.log(sortBy);
			}
		}

	},

	sortByRating: function() {
		var self = this;
		var $searchContainer = $('#search_results .content.scroller');
		var $searchResults = $searchContainer.find('.list-item');
		var $existingResult;
		var sortBy = $('#sort-by').find(':selected').attr('value');
		var htmlObj = [],
			html = '',
			ratingHTML,
		    node,
		    ratings,
		    quality,
		    els;
		if (sortBy == 'rating') {

			// Generate a modified Underscore template taking the ratings as an input
			// We do this so we don't have to mess with the Backbone model
			// It's hacky, but it kind of has to be since we can't directly access the
			// original site's instantiation of `var App`

			this.courses = App.results.models;
			_(this.courses).each(function(course) {
				ratings = LS.get(course.id);
				ratingHTML = self.getRatingHTMLForCourse(LS.get(course.id));
				$existingResult = $searchContainer.find('.list-item[data-id='+course.id+']');
				// Clone with deep nested events
				$cloneResult = $existingResult.clone(true, true);

				if (ratings) {
					quality = ratings.quality;
				} else {
					quality = 0;
				}

				htmlObj.push({ quality: quality, ratingHTML: ratingHTML, item: $cloneResult });
			});

			// Add the ratings html template to the elements that we cloned
			_(htmlObj).each(function(obj) {
				obj.item.find('.meeting').prepend(obj.ratingHTML);
			})

			// Sort it by rating
			htmlObj = _(htmlObj).sortBy(function(obj) {
			    return -(obj.quality - 5);
			});

			// reduce it into one big array of elements
			els = htmlObj.reduce(function(memo, obj) { return memo.add(obj.item); }, $());

			// inject into DOM
			$searchContainer.empty().append(els);
		}
		return;
	},

	// Fetch evals if they aren't cached, then call render
	fetchEvalsAndRender: function() {
		var self = this;
		// Update the courses variable since we may have fetched data
		this.courses = App.results.models;
		_(this.courses).each(function(course) {
			// Render each course with the course data and ratings
			self.getRatingsForCourse(course, self.render, self);
		});
	},

	// Given a course model, fetch its ratings
	getRatingsForCourse: function(course, cb, context) {
		var self = this;
		var id = course.get('id');
		var ratings = LS.get(id);
		if (ratings) {
			return cb(course, ratings, context);
		} else {
			$.ajax({
		         url: "https://ybb.yale.edu/courses/" + id,
		         type: "GET",
		         beforeSend: function(xhr){
		         	xhr.setRequestHeader('Accept', 'application/json, text/javascript, */*; q=0.01');
		         },
		         success: function(data) { 
		         	ratings = self._calculateRatingsFromEvaluations(data.evaluations);
		         	var numFields = _(ratings).chain().values().filter(function(val) { return !_.isUndefined(val); }).value().length;
		         	if (!!numFields) {
		         		LS.set(id, ratings);
		        	}
		         	cb(course, ratings, context);
		         }
  		    });				
		}
		return;
	},

	getTemplate: function(ratings__) {
		var html = this.getRatingHTMLForCourse(ratings__);
		// Add data-new attribute so we know which rows are new
		return _.template('<div class="list-item clearfix" data-new="true" data-id="<%= course.id %>" data-term="<%= course.term.oci %>">\n<span class="icon lock<%= course.lockClass %>">Lock</span>\n	<span class="icon add-course<%= course.addClass %>" data-action="add">Add</span>\n	<span class="icon new-tab-sm" data-action="tab">Tab</span>\n<div class="meeting">\n'+html+ '<div class="compare-add"><input type="checkbox" class="compare-add-check" /></div>\n	<% if(course.canceled){ %>\n<span class="warning">Canceled</span>\n		<% } else { %>\n	<span class="meeting-time"><%= course.sessions.join(\'<br/>\') %></span>\n		<% } %>\n		<br/>\n		<%= course.areas.join(\', \') %>\n		<%= course.term.nice_term %>\n	</div>\n	<h4>\n		<%= course.subject %> <%= course.number %><%= course.section %>\n		<% if(course.number >= 500){ %>\n			<span class="grad">[Grad]</span>\n		<% } %>\n	</h4>\n	<h5><%= course.title %></h5>\n	<h6><%= course.professors.join(\', \') %></h6>\n	<div class="description"><%= course.description %></div>\n</div>');
	},


	getRatingHTMLForCourse: function (ratings_) {
		if (!ratings_) {
			return '<div class="ratings">'+
					  '<span>\n'+
					      'Rating <span data-rating="0" class="quality none"> N/A</span>\n<br/>'+
					      'Work <span data-workload="0" class="workload none"> N/A</span>\n'+
					  '</span>\n'+
					'</div>\n';
		}
		var quality = (+ratings_.quality).toFixed(1);
		var workload = (+ratings_.workload).toFixed(1);
		var qualityClass = this.getCSSSelectorForAttribute(quality);
		var workloadClass = this.getCSSSelectorForAttribute(workload);

		if (quality == 'NaN') { quality = 0; }
		if (workload == 'NaN') { workload = 0; }	

		return '<div class="ratings">'+
				  '<span>\n'+
				      'Rating <span data-rating="'+ (quality || 0) +'" class="quality '+ qualityClass +'">'+ (quality ||' N/A')+'</span>\n<br/>'+
				      'Work <span data-workload="'+ (workload || 0) +'" class="workload '+ workloadClass +'">'+ (workload ||' N/A')+'</span>\n'+
				  '</span>\n'+
				'</div>\n';
	},

	_calculateRatingsFromEvaluations: function(evaluations) {
		var qid = {
			workload: 5,
			quality: 6
		};

	    function averages(ratings_av) {
	    	var obj = _(ratings_av).chain()
					        .reduce(function(memo, rating) {
										return { total_votes: rating.votes + memo.total_votes,
										         total_value: rating.votes * rating.value + memo.total_value};
							                   }, { total_votes: 0, total_value: 0})
							.value()
							;
			return obj.total_value / obj.total_votes;
	    }

		var ratings = _(evaluations).chain()
						.pluck('ratings')
						.flatten()
						.filter(function(rating) { 
							return rating.question_id == qid.workload ||
						           rating.question_id == qid.quality; })
						.groupBy(function(rating){ return rating.question_id; })
						.map(function(rating){ return _(rating).first(5); })
						.value()
						;

		return {
			// If you want to generate fake data:
			// Generates numbers between 2 and 5 since ratings below 2 are rare
			//quality: (Math.random() * 3) + 2,
			//workload: (Math.random() * 3) + 2
			quality: +(+(averages(ratings[1])).toFixed(1)) || undefined,
			workload: +(+(averages(ratings[0])).toFixed(1)) || undefined
		};
	},

	getCSSSelectorForAttribute: function(attr) {
		if (attr > 0 && attr <= 2) {
			return 'a';
		} else if (attr > 2 && attr <= 3) {
			return 'b';
		} else if (attr > 3 && attr <= 4) {
			return 'c';
		} else if (attr > 4) {
			return 'd';
		} else {
			return 'none';
		}
	}
};


var jsInitChecktimer = setInterval(checkForJS_Finish, 111);
function checkForJS_Finish() {
  if (typeof $ != "undefined" &&
      typeof App != "undefined") {
       clearInterval(jsInitChecktimer);
       Anti.init();
  }
}