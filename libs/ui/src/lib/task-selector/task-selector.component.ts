import {
  animate,
  state,
  style,
  transition,
  trigger
} from '@angular/animations';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  Inject
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { ContextualActionBarService } from '@nrwl/angular-console-enterprise-frontend';
import { combineLatest, Observable, Subject } from 'rxjs';
import { map, startWith, take } from 'rxjs/operators';
import { ENVIRONMENT, Environment } from '@angular-console/environment';

export interface Task<T> {
  taskName: string;
  taskDescription?: string;
  task: T;
}

export interface TaskCollection<T> {
  collectionName: string;
  tasks: Array<Task<T>>;
}

export interface TaskCollections<T> {
  taskCollections: Array<TaskCollection<T>>;
  selectedTask: Task<T> | null;
}

const ANIMATION_MILLIS = 450;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-task-selector',
  templateUrl: './task-selector.component.html',
  styleUrls: ['./task-selector.component.scss'],
  animations: [
    trigger('growShrink', [
      state('void', style({ width: '0' })),
      state('collapse', style({ width: '0' })),
      state('expand', style({ width: '*' })),
      transition(
        `collapse <=> expand`,
        animate(`${ANIMATION_MILLIS}ms 150ms  cubic-bezier(0.4, 0.0, 0.2, 1)`)
      )
    ])
  ]
})
export class TaskSelectorComponent<T> implements OnInit, OnDestroy {
  @Input() taskCollections$: Observable<TaskCollections<T>>;
  @Input() filterPlaceholder: string;
  filteredTaskCollections$: Observable<TaskCollections<T>>;

  @Output() readonly selectionChange = new EventEmitter<T | null>();

  readonly taskFilterFormControl = new FormControl();
  readonly taskAnimationState$ = new Subject<'collapse' | 'expand'>();
  readonly application = this.environment.application;

  private readonly contextActionCloseSubscription = this.contextActionService.contextualActions$.subscribe(
    actions => {
      if (actions === null) {
        this.selectionChange.next(null);

        this.taskAnimationState$.next('expand');
      }
    }
  );

  constructor(
    private readonly contextActionService: ContextualActionBarService,
    @Inject(ENVIRONMENT) private readonly environment: Environment
  ) {}

  ngOnInit() {
    this.taskCollections$.pipe(take(1)).subscribe(taskCollections => {
      if (taskCollections.selectedTask) {
        this.taskAnimationState$.next('collapse');
      } else {
        this.taskAnimationState$.next('expand');
      }
    });

    this.filteredTaskCollections$ = combineLatest([
      this.taskFilterFormControl.valueChanges.pipe(
        startWith(''),
        map(value => value.toLowerCase())
      ),
      this.taskCollections$
    ]).pipe(
      map(([lowerCaseFilterValue, taskCollections]) => ({
        selectedTask: taskCollections.selectedTask,
        taskCollections: taskCollections.taskCollections
          .map(collection => {
            if (
              collection.collectionName
                .toLowerCase()
                .includes(lowerCaseFilterValue)
            ) {
              return collection;
            } else {
              return {
                collectionName: collection.collectionName,
                tasks: collection.tasks.filter(
                  task =>
                    task.taskName
                      .toLowerCase()
                      .includes(lowerCaseFilterValue) ||
                    (task.taskDescription &&
                      task.taskDescription
                        .toLowerCase()
                        .includes(lowerCaseFilterValue))
                )
              };
            }
          })
          .filter(collection => Boolean(collection.tasks.length > 0))
      }))
    );
  }

  ngOnDestroy() {
    this.contextActionCloseSubscription.unsubscribe();
    this.selectTask(null);
  }

  trackByCollectionName(_: number, taskCollection: TaskCollection<T>) {
    return taskCollection.collectionName;
  }

  trackByTaskName(_: number, task: Task<T>) {
    return task.taskName;
  }

  selectTask(task: Task<T> | null) {
    if (task) {
      this.selectionChange.next(task.task);
      this.taskAnimationState$.next('collapse');
    } else {
      this.contextActionService.contextualActions$.next(null);
    }
  }
}
